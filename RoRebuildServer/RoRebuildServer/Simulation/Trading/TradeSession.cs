using RebuildSharedData.Enum;
using RebuildSharedData.Enum.EntityStats;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;
using RoRebuildServer.Simulation.Pathfinding;
using RoRebuildServer.Simulation.Util;

namespace RoRebuildServer.Simulation.Trading;

/// <summary>An offered item and the slot it has to come out of.</summary>
public readonly struct TradedItem(int bagId, ItemReference item)
{
    public readonly int BagId = bagId;
    public readonly ItemReference Item = item;
}

/// <summary>One side of the table: what this player has put on it.</summary>
public class TradeOffer
{
    /// <summary>Bag id to how many of it. Bag id rather than item id, so two of the same
    /// unique item are two entries and cannot be confused for one stack of two.</summary>
    public readonly Dictionary<int, int> Items = new();

    public int Zeny;

    /// <summary>Whether this side has agreed to what is on the table right now.</summary>
    public bool Locked;

    /// <summary>Whether this side has said the final yes. Only reachable once both are locked.</summary>
    public bool Confirmed;

    public void Clear()
    {
        Items.Clear();
        Zeny = 0;
        Locked = false;
        Confirmed = false;
    }
}

/// <summary>
/// Two players swapping items and money.
///
/// The two steps - lock, then confirm - are the whole design. With one button, one player
/// agrees, the other swaps what they were offering, and agrees in turn; the first has
/// already said yes to something that is no longer on the table. So agreeing locks the
/// offer, changing anything unlocks both, and the swap needs both to have said yes to the
/// same table twice.
///
/// Nothing moves until <see cref="TryComplete"/>, and that checks everything before it
/// touches a single item. A trade that half happens is worse than one that does not.
/// </summary>
public class TradeSession
{
    public readonly Player A;
    public readonly Player B;

    public readonly TradeOffer OfferA = new();
    public readonly TradeOffer OfferB = new();

    /// <summary>How far apart the two may stand. Past this the trade ends rather than
    /// following them around the map.</summary>
    public const int MaxDistance = 12;

    /// <summary>
    /// Whether the invitation has been accepted.
    ///
    /// Both players hold the session from the moment it is asked for - that is what stops a
    /// third player asking either of them while the question is open - so "there is a
    /// session" is not the same as "there is a trade". Everything but answering the
    /// invitation is refused until this is true, otherwise the asker could put items on a
    /// table the other side has not agreed to sit at.
    /// </summary>
    public bool Started;

    /// <summary>
    /// How long an unanswered invitation stands, in seconds.
    ///
    /// Both players hold the session from the moment it is asked for, so one that is never
    /// answered leaves the asker unable to trade with anybody else and with no window of
    /// their own to call it off from. It expires instead.
    /// </summary>
    private const float RequestTimeout = 30f;

    private readonly float requestedAt;

    public TradeSession(Player a, Player b)
    {
        A = a;
        B = b;
        requestedAt = Time.ElapsedTimeFloat;
    }

    public Player Other(Player p) => p == A ? B : A;
    public TradeOffer OfferOf(Player p) => p == A ? OfferA : OfferB;

    public bool Involves(Player p) => p == A || p == B;

    /// <summary>
    /// Either side changing what they are offering takes both locks off.
    ///
    /// Called from every path that alters an offer, rather than from the ones that looked
    /// like they mattered: an offer that changed while somebody had agreed to it is the one
    /// thing this whole design exists to prevent.
    /// </summary>
    public void Unlock()
    {
        OfferA.Locked = false;
        OfferA.Confirmed = false;
        OfferB.Locked = false;
        OfferB.Confirmed = false;
    }

    public bool BothLocked => OfferA.Locked && OfferB.Locked;
    public bool BothConfirmed => OfferA.Confirmed && OfferB.Confirmed;

    /// <summary>
    /// Whether the two are still in a state where a trade makes sense.
    ///
    /// Checked before every step rather than only at the end, so a trade whose other half
    /// walked off or logged out ends when that happens instead of when somebody presses the
    /// last button.
    /// </summary>
    public bool StillValid(out string reason)
    {
        reason = "";

        if (!A.Entity.IsAlive() || !B.Entity.IsAlive())
        {
            reason = "The other player is no longer available.";
            return false;
        }

        if (A.Character.Map == null || B.Character.Map == null || A.Character.Map != B.Character.Map)
        {
            reason = "The other player has left the area.";
            return false;
        }

        if (A.Character.State == CharacterState.Dead || B.Character.State == CharacterState.Dead)
        {
            reason = "You cannot trade while dead.";
            return false;
        }

        if (A.Character.Position.DistanceTo(B.Character.Position) > MaxDistance)
        {
            reason = "You are too far apart to trade.";
            return false;
        }

        return true;
    }

    /// <summary>
    /// Ends the trade if it has stopped making sense, and says so.
    ///
    /// Called from the players' own tick rather than only from their actions, because most
    /// of the ways a trade dies are things neither of them does to it: one warps out, one
    /// dies, one wanders off. Left to the actions alone, a trade like that ends when
    /// somebody next presses a button - and until then it sits on both of them, blocking
    /// every other trade either might want to start.
    /// </summary>
    public void EndIfStale()
    {
        if (!Started && Time.ElapsedTimeFloat - requestedAt > RequestTimeout)
        {
            End("The trade request went unanswered.");
            return;
        }

        if (StillValid(out var reason))
            return;

        End(reason);
    }

    /// <summary>
    /// Moves everything across, or nothing.
    ///
    /// Every check happens before the first item is taken out of anyone's bag. The order is
    /// deliberate: what is on offer still has to be there, both sides have to have room for
    /// what is coming, and both have to be able to hold the money. Only then does anything
    /// move, and from that line to the end there is no way out - because the way out is what
    /// would leave one player's sword gone and the other's money still their own.
    /// </summary>
    public bool TryComplete(out string reason)
    {
        if (!StillValid(out reason))
            return false;

        if (!BothLocked || !BothConfirmed)
        {
            reason = "Both players have to agree first.";
            return false;
        }

        //--- gather what is being handed over, and check it is all still there ------
        if (!Collect(A, OfferA, out var fromA, out reason))
            return false;
        if (!Collect(B, OfferB, out var fromB, out reason))
            return false;

        //--- and that the other side can take it ------------------------------------
        //Each side's own offer is passed in as well, because it leaves their bag before the
        //other side's arrives: refusing a straight swap by a player whose bag is full would
        //make the last slot untradeable.
        if (!HasRoom(B, fromA, OfferA.Zeny, fromB, out reason))
            return false;
        if (!HasRoom(A, fromB, OfferB.Zeny, fromA, out reason))
            return false;

        //--- nothing below here may fail --------------------------------------------
        Hand(A, B, fromA, OfferA.Zeny);
        Hand(B, A, fromB, OfferB.Zeny);

        CommandBuilder.SendUpdatePlayerData(A, true, false, A.HasCart);
        CommandBuilder.SendUpdatePlayerData(B, true, false, B.HasCart);

        return true;
    }

    /// <summary>
    /// Takes an offer apart into the items it actually names, refusing if any of it has
    /// gone. An offer is a list of bag ids and the bag they point into can change under
    /// it - things get sold, dropped, used - so what was promised is checked, not assumed.
    /// </summary>
    private static bool Collect(Player from, TradeOffer offer, out List<TradedItem> items, out string reason)
    {
        items = new List<TradedItem>();
        reason = "";

        if (offer.Zeny < 0 || offer.Zeny > from.GetData(PlayerStat.Zeny))
        {
            reason = $"{from.Name} no longer has that much zeny.";
            return false;
        }

        var bag = from.Inventory;
        if (bag == null)
        {
            if (offer.Items.Count == 0)
                return true;

            reason = $"{from.Name} no longer has one of the offered items.";
            return false;
        }

        foreach (var (bagId, count) in offer.Items)
        {
            if (count <= 0 || bag.GetItemCountByBagId(bagId) < count)
            {
                reason = $"{from.Name} no longer has one of the offered items.";
                return false;
            }

            if (!bag.GetItem(bagId, out var item))
            {
                reason = $"{from.Name} no longer has one of the offered items.";
                return false;
            }

            //Something worn cannot be handed over, the same way it cannot be dropped or put
            //in storage. Checked here as well as when it was offered, because a player can
            //equip what is already on the table between the two moments.
            if (from.Equipment != null && from.Equipment.IsItemEquipped(bagId))
            {
                reason = $"{from.Name} is wearing one of the offered items.";
                return false;
            }

            //A unique item is one thing in one slot: the bag throws rather than splitting
            //one, and it would throw from inside the part of this that cannot fail. So a
            //partial count of one is refused out here, where refusing still means nothing
            //has moved.
            if (item.Type == ItemType.UniqueItem && count != item.Count)
            {
                reason = $"{from.Name} cannot split one of the offered items.";
                return false;
            }

            item.Count = count;
            //the slot travels with the item. Removing wants the slot, and looking one back up
            //from the item would pick the wrong one whenever two slots hold the same thing.
            items.Add(new TradedItem(bagId, item));
        }

        return true;
    }

    /// <summary>
    /// Whether one side can take what is coming, counting all of it at once.
    ///
    /// Asking the bag about each item on its own is not the same question: ten items each
    /// fitting the one free slot is ten answers of yes and one slot, and the bag's add has
    /// no refusal of its own - it increments past the limit and the player ends up over
    /// weight with a bag bigger than the game allows. So the slots and the weight are added
    /// up here, against the state the bag will actually be in: what this player is giving
    /// away has left it by the time the other side's items arrive.
    /// </summary>
    private static bool HasRoom(Player to, List<TradedItem> incoming, int zeny,
        List<TradedItem> outgoing, out string reason)
    {
        reason = "";

        //int is what zeny is stored in, and a trade that would push somebody past it would
        //silently clamp - which is money quietly destroyed rather than moved
        if (int.MaxValue - zeny < to.GetData(PlayerStat.Zeny))
        {
            reason = $"{to.Name} cannot carry that much zeny.";
            return false;
        }

        var bag = to.Inventory;
        var slots = bag?.UsedSlots ?? 0;
        var weight = bag?.BagWeight ?? 0;

        //how many of each regular item is left once this player's own offer has gone, so a
        //stack arriving into a slot that is about to empty is not counted as a new slot
        var remaining = new Dictionary<int, int>();
        if (bag != null)
        {
            foreach (var (id, item) in bag.RegularItems)
                remaining[id] = item.Count;
        }

        foreach (var entry in outgoing)
        {
            weight -= entry.Item.Weight * entry.Item.Count;

            if (entry.Item.Type != ItemType.RegularItem)
            {
                slots--;
                continue;
            }

            var id = entry.Item.Id;
            var left = remaining.TryGetValue(id, out var held) ? held - entry.Item.Count : 0;
            remaining[id] = left;
            if (left <= 0)
            {
                remaining.Remove(id);
                slots--;
            }
        }

        foreach (var entry in incoming)
        {
            weight += entry.Item.Weight * entry.Item.Count;

            if (entry.Item.Type != ItemType.RegularItem)
            {
                //a unique item is always its own slot, no matter how many of its id are held
                slots++;
                continue;
            }

            var id = entry.Item.Id;
            if (remaining.TryGetValue(id, out var held))
            {
                //the same cap the bag's own pick up check uses, so a stack cannot be walked
                //past its limit by trading into it
                if (held + entry.Item.Count >= 30000)
                {
                    reason = $"{to.Name} already has too many of one of those.";
                    return false;
                }

                remaining[id] = held + entry.Item.Count;
            }
            else
            {
                remaining[id] = entry.Item.Count;
                slots++;
            }
        }

        if (slots > CharacterBag.MaxBagSlots)
        {
            reason = $"{to.Name} does not have enough space.";
            return false;
        }

        //admins ignore weight everywhere else, so they ignore it here too
        if (!to.IsAdmin && weight > to.GetStat(CharacterStat.WeightCapacity))
        {
            reason = $"{to.Name} cannot carry that much.";
            return false;
        }

        return true;
    }

    private static void Hand(Player from, Player to, List<TradedItem> items, int zeny)
    {
        foreach (var entry in items)
        {
            if (from.Inventory == null || !from.Inventory.RemoveItemByBagIdAndGetRemovedItem(
                    entry.BagId, entry.Item.Count, out var removed))
            {
                //Checked already in Collect, so reaching here means the bag changed between
                //the check and now. Logged rather than thrown: there is nothing sensible to
                //unwind to at this point, and a warning that names both players is what makes
                //it findable if it ever happens.
                ServerLogger.LogWarning($"Trade between {from.Name} and {to.Name}: bag slot "
                                        + $"{entry.BagId} vanished between being checked and "
                                        + "being handed over.");
                continue;
            }

            to.AddItemToInventory(removed);
        }

        if (zeny <= 0)
            return;

        from.DropZeny(zeny);
        to.AddZeny(zeny);
    }

    /// <summary>
    /// Ends it for both, tells whoever is still there, and leaves neither holding a dead
    /// session.
    ///
    /// The commonest reason a trade ends is that one of the two left, so being told is
    /// checked rather than assumed: a message queued against a connection that has gone is
    /// taken apart on the sending thread, which is a long way from here.
    /// </summary>
    public void End(string reason)
    {
        if (A.Connection != null)
            CommandBuilder.SendTradeCancelled(A, reason);
        if (B.Connection != null)
            CommandBuilder.SendTradeCancelled(B, reason);

        A.Trade = null;
        B.Trade = null;
    }
}

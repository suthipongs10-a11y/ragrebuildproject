using RebuildSharedData.Enum;
using RoRebuildServer.Database;
using RoRebuildServer.Database.Domain;
using RoRebuildServer.Database.Requests;
using RoRebuildServer.EntityComponents;
using RoRebuildServer.EntityComponents.Items;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Simulation.Market;

/// <summary>
/// The parcel box: where anything the market owes somebody waits until they collect it.
///
/// It exists because the other half of a sale is almost never logged in when the sale
/// happens. Without somewhere to put the proceeds, an auction could only ever settle
/// between two people who both happened to be online at the moment it ended, which is to
/// say almost never - so the item and the money would have to either vanish or be handed
/// out later by hand.
///
/// Nothing here hands anything over. A parcel is written to the database and read back
/// from it, and the row is deleted in the same breath as it is paid out, so the one thing
/// that must never happen - the same sword arriving twice - cannot.
/// </summary>
public static class Inbox
{
    /// <summary>
    /// Puts something aside for a character to collect, wherever they are.
    ///
    /// Safe to call from the game thread or from the database thread; either way it is a
    /// row waiting to be inserted. Nothing is checked against a limit: refusing to pay
    /// somebody because their box is full would mean destroying what they had won.
    /// </summary>
    public static void Send(Guid characterId, ParcelReason reason, string? fromName,
        int zeny = 0, ItemReference? item = null)
    {
        if (characterId == Guid.Empty)
            return;
        if (zeny <= 0 && item == null)
            return; //an empty parcel is a row nobody can do anything with

        var parcel = new DbInboxParcel
        {
            CharacterId = characterId,
            Reason = (byte)reason,
            FromName = fromName,
            Zeny = zeny < 0 ? 0 : zeny,
            SentAt = DateTime.UtcNow,
        };

        if (item != null)
            parcel.StoreItem(item.Value);

        RoDatabase.EnqueueDbRequest(new InboxSendRequest(parcel));
    }

    /// <summary>
    /// Tries to hand one parcel's contents over, on the game thread where the bag lives.
    ///
    /// Returns false when it could not, and the caller's job is then to write the parcel
    /// back - this is only ever called after the row has already been deleted, so a
    /// refusal that is not put back is an item that stopped existing.
    /// </summary>
    public static bool TryDeliver(Player player, int zeny, ItemReference? item)
    {
        //Asked before anything is added, because adding half of a parcel and failing on
        //the rest would leave it owing an amount nobody wrote down.
        if (item != null && !CanFit(player, item.Value))
            return false;

        if (item != null)
            player.CreateItemInInventory(item.Value);

        if (zeny > 0)
            player.AddZeny(zeny); //tells the client on its own way out

        return true;
    }

    /// <summary>
    /// Whether this item can go into the bag as it stands.
    ///
    /// Three ways it cannot, and two of them are worse than a full bag. Adding a unique
    /// item whose id is already in there throws rather than refusing, and a throw inside a
    /// packet handler takes the rest of the handler with it. And a regular stack is counted
    /// in a short, so a large enough delivery onto a large enough pile wraps it negative -
    /// which reads as items appearing out of nowhere, later, somewhere else.
    /// </summary>
    private static bool CanFit(Player player, ItemReference item)
    {
        var bag = player.Inventory;
        if (bag == null)
            return false;

        if (item.Type == ItemType.UniqueItem)
        {
            if (bag.UniqueItemBagIds.ContainsKey(item.UniqueItem.UniqueId))
                return false;

            return bag.UsedSlots < CharacterBag.MaxBagSlots;
        }

        if (bag.RegularItems.TryGetValue(item.Item.Id, out var existing))
            return existing.Count + item.Item.Count <= short.MaxValue;

        return bag.UsedSlots < CharacterBag.MaxBagSlots;
    }

    /// <summary>
    /// Gives money back, straight into the purse if they are online and into a parcel if
    /// they are not.
    ///
    /// Money is the one thing that always fits, so unlike an item this cannot be refused -
    /// which is why being outbid does not clutter the box of somebody who is standing
    /// there watching the auction. Safe from the database thread: the handing over is
    /// queued onto the game thread, where the purse lives.
    /// </summary>
    public static void RefundZeny(Guid characterId, int zeny, ParcelReason reason, string? fromName)
    {
        if (characterId == Guid.Empty || zeny <= 0)
            return;

        World.Instance.MainThreadActions.Push(() =>
        {
            var player = FindOnline(characterId);
            if (player != null)
            {
                player.AddZeny(zeny);
                return;
            }

            Send(characterId, reason, fromName, zeny);
        });
    }

    /// <summary>Tells a player how much is waiting, if they are here to be told.</summary>
    public static void NotifyCount(Guid characterId, int waiting)
    {
        var player = FindOnline(characterId);
        if (player != null)
            CommandBuilder.SendInboxCount(player, waiting);
    }

    /// <summary>
    /// The player this character id belongs to, if they are online right now.
    ///
    /// Checked by character id rather than by holding onto a Player: the object is pooled
    /// and reused, so one kept across a log out would be somebody else by the time it was
    /// read.
    /// </summary>
    public static Player? FindOnline(Guid characterId)
    {
        foreach (var (_, connection) in NetworkManager.ConnectedAccounts)
        {
            var player = connection.Player;
            if (player != null && player.Id == characterId && connection.IsConnectedAndInGame)
                return player;
        }

        return null;
    }
}

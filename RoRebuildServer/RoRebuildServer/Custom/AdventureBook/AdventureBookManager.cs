using RoRebuildServer.Data;
using RoRebuildServer.Data.ServerConfigScript;
using RoRebuildServer.Logging;

namespace RoRebuildServer.Custom.AdventureBook;

/// <summary>
/// Builds the adventure book once the world is up, then hands it to whoever asks.
/// </summary>
/// <remarks>
/// Nothing about the book is written down by hand. The regions come from Instances.csv, the
/// monsters and their numbers from whatever spawn rules the maps actually loaded, and the
/// cards from the drop tables. Add a map to a region and its monsters appear in the book on
/// the next restart with no code touched, which is the only way a book covering hundreds of
/// monsters stays true a month from now.
///
/// Kept behind ActiveEvents so it can be switched off in appsettings.json without a rebuild,
/// the same way the milestone event is.
/// </remarks>
public class AdventureBookManager : ServerConfigScriptHandlerBase
{
    public const string EventName = "AdventureBook";

    public static bool IsEnabled { get; private set; }

    public override void PostServerStartEvent()
    {
        IsEnabled = ServerConfig.OperationConfig.ActiveEvents?.Contains(EventName) ?? false;
        if (!IsEnabled)
            return;

        try
        {
            AdventureBook.Build();
        }
        catch (Exception e)
        {
            //A book that fails to build must not take the server down with it. Everything it
            //does is additive, so a server without one is a server that plays exactly as it
            //did before, and that is a far better outcome than not starting.
            IsEnabled = false;
            ServerLogger.LogError($"[AdventureBook] Failed to build, so it is switched off for this run: {e}");
        }
    }
}

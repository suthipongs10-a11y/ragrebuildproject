using RoRebuildServer.Custom.Moderation;
using RoRebuildServer.Logging;
using RoRebuildServer.Server;
using Serilog;
using RoRebuildServer.ScriptSystem;


if (args.Length > 0 && args[0] == "compile")
{
    ScriptLoader.CompilerEntryPoint();
    return;
}

try
{
    if (!Console.IsOutputRedirected)
    {
        Console.Clear();
    }
}
catch (IOException)
{
    Console.WriteLine("[WARN] Console.Clear() failed — skipping.");
}

//Before the host is listening, not after: this is the pass that shuts the cheat settings on
//a live server and names the ones left open on any other. ServerConfig reads the settings
//files itself rather than through the host, so it can be asked this early.
var host = CreateHostBuilder(args).Build();
ServerLockdown.Apply();
host.Run();

IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .UseSerilog(ServerLogger.GetLogger())
        .ConfigureWebHostDefaults(webBuilder =>
        {
            webBuilder.UseStartup<WebSocketGameServer>();
        });


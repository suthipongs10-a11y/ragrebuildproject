using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using RoRebuildServer.Logging;
using RoRebuildServer.Networking;

namespace RoRebuildServer.Server;

internal class WebSocketGameServer
{
    // This method gets called by the runtime. Use this method to add services to the container.
    // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddHostedService<ZoneWorker>();
    }

    // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
    public void Configure(IApplicationBuilder app, IWebHostEnvironment env, IConfiguration config)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        //Behind nginx every connection arrives from 127.0.0.1, and the address bans, the
        //per-address limits and the address log would all be looking at the proxy. This
        //reads the real address out of the header nginx adds. Only a proxy on this same
        //machine is trusted for it, which is the default and is how deploy/ sets it up.
        app.UseForwardedHeaders(new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
        });

        var webSocketOptions = new WebSocketOptions() { KeepAliveInterval = TimeSpan.FromSeconds(30), };

        app.UseWebSockets(webSocketOptions);

        //The socket is mapped rather than tested inside a catch-all, because a catch-all
        //ends the pipeline: the file server underneath it never ran, which is why serving
        //the browser build did nothing before.
        app.Map("/ws", socket => socket.Run(async context =>
        {
            if (context.WebSockets.IsWebSocketRequest)
            {
                using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                await NetworkManager.ReceiveConnection(context, webSocket);
            }
        }));

        ServeWebClient(app, config);
    }

    /// <summary>
    /// Hands out the browser build from the game server itself.
    ///
    /// One process and one port for both the page and the socket, which is what makes
    /// playing on a phone a matter of typing the PC's address into it. Two servers would
    /// mean two ports open, two things to start, and a cross-origin rule to satisfy.
    ///
    /// The folder is a setting rather than a constant because it does not exist on a
    /// machine that has never made a browser build, and a server that refuses to start for
    /// want of a folder nobody asked for would be a poor trade.
    /// </summary>
    private static void ServeWebClient(IApplicationBuilder app, IConfiguration config)
    {
        var configured = config["WebClientPath"];
        var path = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(AppContext.BaseDirectory, "WebClient")
            : Path.GetFullPath(configured, AppContext.BaseDirectory);

        if (!Directory.Exists(path))
        {
            ServerLogger.Log($"No browser build at {path}, so only the socket is being served. "
                             + "Build the client for WebGL into that folder to play from a browser.");
            return;
        }

        //Unity's output is not all types a web server knows by default, and a wasm file
        //served as something else is refused by the browser rather than guessed at
        var types = new FileExtensionContentTypeProvider();
        types.Mappings[".wasm"] = "application/wasm";
        types.Mappings[".data"] = "application/octet-stream";
        types.Mappings[".bundle"] = "application/octet-stream";
        types.Mappings[".unityweb"] = "application/octet-stream";
        types.Mappings[".mem"] = "application/octet-stream";
        types.Mappings[".symbols.json"] = "application/json";

        var files = new PhysicalFileProvider(path);

        app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = files,
            ContentTypeProvider = types,
            ServeUnknownFileTypes = true,
            DefaultContentType = "application/octet-stream",
            OnPrepareResponse = ctx =>
            {
                //A compressed Unity build ships file.wasm.br rather than file.wasm, and the
                //browser only unpacks it if it is told the body is packed. Without this the
                //build loads as gibberish and the only clue is a decode error, so it is
                //handled here rather than making the build settings a thing to remember.
                var name = ctx.File.Name;
                if (name.EndsWith(".br", StringComparison.OrdinalIgnoreCase))
                    ctx.Context.Response.Headers.ContentEncoding = "br";
                else if (name.EndsWith(".gz", StringComparison.OrdinalIgnoreCase))
                    ctx.Context.Response.Headers.ContentEncoding = "gzip";
                else
                    return;

                //the real type is the one under the compression suffix
                var inner = Path.GetFileNameWithoutExtension(name);
                if (types.TryGetContentType(inner, out var contentType))
                    ctx.Context.Response.ContentType = contentType;
            }
        });

        ServerLogger.Log($"Serving the browser build from {path}");
    }
}

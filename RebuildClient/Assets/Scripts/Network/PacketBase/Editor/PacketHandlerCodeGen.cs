using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using Assets.Scripts.Network.HandlerBase;
using RebuildSharedData.Networking;
using UnityEditor;
using UnityEditor.Compilation;
using UnityEngine;

namespace Assets.Scripts.Network
{
    public static class PacketHandlerCodeGen
    {
        [MenuItem("Ragnarok/CodeGen/Update Packet Handlers", false, 120)]
        public static void UpdatePacketHandlers()
        {
            var count = System.Enum.GetNames(typeof(PacketType)).Length;

            var code = new StringBuilder();

            var handlers = new List<string>();
            for (var i = 0; i < count; i++)
                handlers.Add($"\t\t\thandlers[{i}] = new InvalidPacket(); //{(PacketType)i}");

            //Collected from the handlers that were actually found rather than listed here by
            //hand. The list used to be written out above, which meant a handler in a folder
            //nobody had thought of yet generated a file that would not compile - and the
            //first guild packet did exactly that. Whatever namespace a handler turns up in
            //is imported because it turned up there.
            //InvalidPacket fills every slot nothing handles and carries no attribute of its
            //own, so its namespace is never discovered and has to be named outright.
            var namespaces = new SortedSet<string>(StringComparer.Ordinal)
            {
                "Assets.Scripts.Network.IncomingPacketHandlers"
            };

            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                foreach (var type in assembly.GetTypes().Where(t => t.IsClass && t.GetCustomAttribute<ClientPacketHandlerAttribute>() != null))
                {
                    //var handler = (SkillHandlerBase)Activator.CreateInstance(type)!;
                    var attr = type.GetCustomAttribute<ClientPacketHandlerAttribute>();
                    var packetType = attr.PacketType;

                    //A handler for a packet the client's copy of the enum does not have yet
                    //would otherwise be written past the end of the array. That happens when
                    //the shared library is newer than the one in the client, which is the
                    //normal state of things between a server build and updateclient.bat.
                    if ((int)packetType < 0 || (int)packetType >= count)
                    {
                        Debug.LogWarning($"[PacketHandlerCodeGen] {type.Name} handles {packetType}, which is "
                                         + "not in this client's PacketType. Run updateclient.bat and generate "
                                         + "again.");
                        continue;
                    }

                    if (!string.IsNullOrEmpty(type.Namespace))
                        namespaces.Add(type.Namespace);

                    handlers[(int)packetType] = $"\t\t\thandlers[{(int)packetType}] = new {type.Name}(); //{packetType}";
                }
            }

            code.Append("using Assets.Scripts.Network;\nusing Assets.Scripts.Network.PacketBase;\n");
            foreach (var space in namespaces)
                code.Append($"using {space};\n");
            code.Append("using Assets.Scripts.Network.HandlerBase;\n\n");
            code.Append("namespace Assets.Scripts.Network.PacketBase\n{\n\tpublic static partial class ClientPacketHandler\n\t{\n\t\tstatic ClientPacketHandler()\n\t\t{\n");
            code.Append($"\t\t\thandlers = new ClientPacketHandlerBase[{count}];\n");

            foreach (var l in handlers)
                code.Append(l).Append("\n");

            code.Append("\t\t}\n\t}\n}\n");
            
            File.WriteAllText(@"Assets\Scripts\Network\PacketBase\ClientPacketHandlerGenerated.cs", code.ToString());
            
            CompilationPipeline.RequestScriptCompilation();
        }
    }
}
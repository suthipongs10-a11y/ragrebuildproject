using System.Formats.Tar;

// Packs a folder into a .tar for deploy/install-bundle.sh, using .NET's own tar writer.
//
//     dotnet run --project deploy\bundler -c Release -- <folder> <output.tar>
//
// This exists because Windows' tar.exe has been seen to crash outright (exit code
// -1073741819, an access violation) part way through the bundle, in the middle of the
// Addressables folder, with no message. It is the fallback publish.ps1 reaches for when
// that happens.
//
// What it has to get right is the same thing tar.exe was chosen for: file names reach
// the server byte for byte. Names are written as UTF-8 in pax extended headers, which
// GNU tar on the VPS reads back as they were - unlike Compress-Archive, whose zip names
// came back through a legacy codepage and turned every Korean player sprite into
// something else.
//
// Entry names are relative to <folder> with forward slashes, which is what
// "tar -xf bundle -C /opt/rorebuild/server" wants. File modes are left to
// install-bundle.sh, which chmods what needs it and chowns the lot.

if (args.Length != 2)
{
    Console.Error.WriteLine("usage: Bundler <folder> <output.tar>");
    return 2;
}

var source = Path.GetFullPath(args[0]);
var output = Path.GetFullPath(args[1]);

if (!Directory.Exists(source))
{
    Console.Error.WriteLine($"No such folder: {source}");
    return 2;
}

var entries = Directory.EnumerateFileSystemEntries(source, "*", SearchOption.AllDirectories)
    .Select(p => (Full: p, Name: Path.GetRelativePath(source, p).Replace('\\', '/')))
    .OrderBy(e => e.Name, StringComparer.Ordinal)
    .ToList();

Console.WriteLine($"Packing {entries.Count:N0} entries from {source}");

var current = "";
var bytes = 0L;
var count = 0;

try
{
    using var stream = new FileStream(output, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 20);
    using var writer = new TarWriter(stream, TarEntryFormat.Pax, leaveOpen: false);

    foreach (var (full, name) in entries)
    {
        current = full;
        writer.WriteEntry(fileName: full, entryName: name);
        count++;

        if (!Directory.Exists(full))
            bytes += new FileInfo(full).Length;

        if (count % 2000 == 0)
            Console.WriteLine($"  {count:N0} / {entries.Count:N0}   {bytes / 1048576.0:N0} MB");
    }
}
catch (Exception e)
{
    Console.Error.WriteLine();
    Console.Error.WriteLine($"Failed on: {current}");
    Console.Error.WriteLine(e.Message);
    return 1;
}

Console.WriteLine($"Done. {count:N0} entries, {bytes / 1048576.0:N0} MB of files, {new FileInfo(output).Length / 1048576.0:N0} MB tar -> {output}");
return 0;

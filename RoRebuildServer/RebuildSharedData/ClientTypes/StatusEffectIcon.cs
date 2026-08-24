namespace RebuildSharedData.ClientTypes;

/// <summary>
/// How a status effect's Icon line is read.
/// </summary>
/// <remarks>
/// Its own class rather than a constant on StatusEffectData, because that type is a model
/// Tomlyn maps a file onto field by field, and a class it reflects over is not a place to
/// leave anything that is not one of the file's fields.
/// </remarks>
public static class StatusEffectIcon
{
    /// <summary>
    /// What an Icon line starts with to point at an item's own picture rather than at a file
    /// in the client's status icon folder.
    /// </summary>
    /// <remarks>
    /// texture/effect is a closed set - it holds the status icons the game shipped with, and
    /// there is nothing in it for a status this server invented. A buff that comes from an
    /// item has a right picture already: the item's own, which is in the icon atlas the
    /// client already built. Writing Icon = "item:Battle_Manual" says so in the data, so the
    /// next one costs a line in a text file rather than a table in the client.
    /// </remarks>
    public const string ItemIconPrefix = "item:";
}

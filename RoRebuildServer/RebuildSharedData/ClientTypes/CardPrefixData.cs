namespace RebuildSharedData.ClientTypes;

[Serializable]
public class CardPrefixData
{
    public int Id;
    public string? Prefix;
    public string? Postfix;

    //The names for two, three and four of it in one item. Empty means the generic
    //"Double"/"Triple"/"Quadruple" form, which is what every card uses.
    public string? Prefix2;
    public string? Prefix3;
    public string? Prefix4;
}

[Serializable]
public class CardPrefixDataList
{
    public List<CardPrefixData>? Items;
}
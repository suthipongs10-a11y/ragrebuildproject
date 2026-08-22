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

    //Where it sorts among the other prefixes on one item, low first. The forger's name
    //goes in at order 1, which is what puts it between the star crumbs and the element.
    public int Order;
}

[Serializable]
public class CardPrefixDataList
{
    public List<CardPrefixData>? Items;
}
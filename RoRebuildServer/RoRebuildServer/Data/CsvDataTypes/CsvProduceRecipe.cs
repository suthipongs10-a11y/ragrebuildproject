namespace RoRebuildServer.Data.CsvDataTypes;

/// <summary>
/// One row of Db/ProduceRecipes.csv - a thing a crafting skill can make.
///
/// Items are named by Code rather than by id so a row reads as what it is, and three
/// material columns because nothing a blacksmith makes needs a fourth. An unused pair is
/// left blank with an amount of zero.
/// </summary>
public class CsvProduceRecipe
{
    /// <summary>Item code of what comes out.</summary>
    public required string Result { get; set; }

    /// <summary>How many come out of one attempt.</summary>
    public required int Count { get; set; }

    /// <summary>The skill that makes it, which is also the window it appears in.</summary>
    public required string Skill { get; set; }

    /// <summary>Level of that skill this recipe needs before it will show up at all.</summary>
    public required int MinSkillLevel { get; set; }

    /// <summary>
    /// The recipe's own share of the odds, in ten-thousandths.
    ///
    /// Everything the character brings - skill level, job level, dex and luk - is added on
    /// top of this at the moment of the attempt, so this column is the difficulty of the
    /// thing itself and nothing else.
    /// </summary>
    public required int BaseChance { get; set; }

    public string? Material1 { get; set; }
    public int Amount1 { get; set; }
    public string? Material2 { get; set; }
    public int Amount2 { get; set; }
    public string? Material3 { get; set; }
    public int Amount3 { get; set; }

    /// <summary>The fee, taken whether or not the attempt succeeds.</summary>
    public int Zeny { get; set; }
}

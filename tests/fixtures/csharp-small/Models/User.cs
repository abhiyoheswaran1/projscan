namespace MyApp.Models;

public class User
{
    private string name;

    public User(string name)
    {
        this.name = name;
    }

    public string Classify(int score)
    {
        return score switch
        {
            0 => "zero",
            1 => "low",
            2 => "low",
            _ => "other",
        };
    }

    public string Name() => this.name;
}

internal class Hidden
{
    public int Tag { get; set; }
}

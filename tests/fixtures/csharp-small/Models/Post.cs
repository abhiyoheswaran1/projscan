using AppUser = MyApp.Models.User;

namespace MyApp.Models;

public class Post
{
    private AppUser author;

    public Post(AppUser author)
    {
        this.author = author;
    }

    public string AuthorName() => this.author.Name();
}

using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;

namespace Application.Services;

public interface IEmailService
{
    void Send(string to, string subject, string body);
}

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;
    public SmtpEmailService(IConfiguration config) => _config = config;

    public void Send(string to, string subject, string body)
    {
        var smtp = new SmtpClient(_config["Smtp:Host"], int.Parse(_config["Smtp:Port"]))
        {
            Credentials = new NetworkCredential(_config["Smtp:User"], _config["Smtp:Pass"]),
            EnableSsl = true
        };
        smtp.Send(new MailMessage(_config["Smtp:From"], to, subject, body));
    }
}
using System;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;           
using System.Threading.Tasks;
using System.Security.Claims;
using Application.Services;
using Infrastructure;
using Infrastructure.SignalR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.ReferenceHandler =
            ReferenceHandler.IgnoreCycles;
        opts.JsonSerializerOptions.WriteIndented = true;

        opts.JsonSerializerOptions.Converters
            .Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.CustomSchemaIds(t => t.FullName.Replace('.', '_'));
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "API V1", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name        = "Authorization",
        Type        = SecuritySchemeType.Http,
        Scheme      = "Bearer",
        BearerFormat= "JWT",
        In          = ParameterLocation.Header,
        Description = "Enter JWT Token as: Bearer {token}"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme {
                Reference = new OpenApiReference {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddDbContext<ClothingStoreDbContext>(opts =>
    opts.UseNpgsql(builder.Configuration.GetConnectionString("PSQLCONN"))
);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IProposedChangeService, ProposedChangeService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<BusinessService>();
builder.Services.AddScoped<ApprovalService>();
builder.Services.AddScoped<ClothingItemService>();
builder.Services.AddScoped<ReservationService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<PasswordResetService>();
builder.Services.AddSignalR();

builder.Services.AddCors(opts =>
{
    opts.AddPolicy("CorsPolicy", policy =>
    {
        policy
          .SetIsOriginAllowed(_ => true)
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials();
    });
});

builder.Services
  .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
  .AddJwtBearer(options =>
  {
      var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]);
      options.TokenValidationParameters = new TokenValidationParameters
      {
          ValidateIssuer           = true,
          ValidateAudience         = true,
          ValidateLifetime         = true,
          ValidateIssuerSigningKey = true,

          ValidIssuer              = builder.Configuration["Jwt:Issuer"],
          ValidAudience            = builder.Configuration["Jwt:Audience"],
          IssuerSigningKey         = new SymmetricSecurityKey(key),

          RoleClaimType            = ClaimTypes.Role,
          NameClaimType            = ClaimTypes.NameIdentifier
      };

      options.Events = new JwtBearerEvents
      {
          OnMessageReceived = context =>
          {
              var accessToken = context.Request.Query["access_token"];
              var path = context.HttpContext.Request.Path;
              if (!string.IsNullOrEmpty(accessToken) &&
                  path.StartsWithSegments("/notificationHub"))
              {
                  context.Token = accessToken;
              }
              return Task.CompletedTask;
          }
      };
  });

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "API V1"));
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        context.Response.Headers["Access-Control-Allow-Origin"]  = "*";
        context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
        context.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";

        var feature = context.Features.Get<IExceptionHandlerFeature>();
        if (feature != null)
        {
            var result = JsonSerializer.Serialize(new { error = feature.Error.Message });
            await context.Response.WriteAsync(result);
        }
    });
});

app.UseRouting();
app.UseCors("CorsPolicy");
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (ctx, next) =>
{
    if (ctx.User.Claims.Any())
    {
        Console.WriteLine("Claims:");
        foreach (var c in ctx.User.Claims)
            Console.WriteLine($"  {c.Type}: {c.Value}");
    }
    else
    {
        Console.WriteLine("No claims found.");
    }
    await next();
});

app.MapControllers();
app.MapHub<NotificationHub>("/notificationHub")
   .RequireCors("CorsPolicy");

app.Run();

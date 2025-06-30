FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /app

# Copy solution and project files
COPY *.sln ./
COPY EDClothingMS/*.csproj ./EDClothingMS/
COPY Infrastructure/*.csproj ./Infrastructure/
COPY Application/*.csproj ./Application/
COPY Domain/*.csproj ./Domain/

# Restore dependencies
RUN dotnet restore

# Copy all source files
COPY . .

# Publish the main web project
RUN dotnet publish ./EDClothingMS/EDClothingMS.csproj -c Release -o /app/published

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:6.0
WORKDIR /app
COPY --from=build /app/published .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://0.0.0.0:5000
ENTRYPOINT ["dotnet", "EDClothingMS.dll"]


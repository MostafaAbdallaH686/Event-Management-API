Write-Host "🎯 Interactive API Tester" -ForegroundColor Cyan
Write-Host "=" * 60

$baseUrl = "http://localhost:8080"

# Login
Write-Host "`n🔐 Logging in as admin..." -ForegroundColor Yellow
$loginBody = @{
    email = "admin@eventmanagement.com"
    password = "Admin@123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

$token = $response.token
Write-Host "✅ Logged in as $($response.user.username)" -ForegroundColor Green

# Menu
while ($true) {
    Write-Host "`n📋 Choose an action:" -ForegroundColor Cyan
    Write-Host "1. List all events"
    Write-Host "2. Create an event"
    Write-Host "3. Get dashboard stats"
    Write-Host "4. Exit"
    
    $choice = Read-Host "`nEnter your choice (1-4)"
    
    switch ($choice) {
        "1" {
            Write-Host "`n📅 Fetching events..." -ForegroundColor Yellow
            $events = Invoke-RestMethod -Uri "$baseUrl/api/events"
            
            if ($events.Count -eq 0) {
                Write-Host "No events found" -ForegroundColor Gray
            } else {
                foreach ($event in $events) {
                    Write-Host "`n• $($event.title)" -ForegroundColor Green
                    Write-Host "  Location: $($event.location)" -ForegroundColor Gray
                    Write-Host "  Date: $($event.dateTime)" -ForegroundColor Gray
                    Write-Host "  Attendees: $($event.maxAttendees)" -ForegroundColor Gray
                }
            }
        }
        
        "2" {
            Write-Host "`n📝 Create a new event" -ForegroundColor Yellow
            
            $title = Read-Host "Event title"
            $description = Read-Host "Description"
            $location = Read-Host "Location"
            $maxAttendees = Read-Host "Max attendees"
            
            # Get first category
            $events = Invoke-RestMethod -Uri "$baseUrl/api/events"
            if ($events.Count -gt 0) {
                $categoryId = $events[0].categoryId
            } else {
                Write-Host "❌ No categories found" -ForegroundColor Red
                continue
            }
            
            $headers = @{ Authorization = "Bearer $token" }
            $body = @{
                title = $title
                description = $description
                dateTime = (Get-Date).AddDays(30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
                location = $location
                maxAttendees = [int]$maxAttendees
                categoryId = $categoryId
                paymentRequired = $false
            } | ConvertTo-Json
            
            $newEvent = Invoke-RestMethod -Uri "$baseUrl/api/events" `
                -Method POST `
                -Headers $headers `
                -ContentType "application/json" `
                -Body $body
            
            Write-Host "✅ Event created: $($newEvent.title)" -ForegroundColor Green
        }
        
        "3" {
            Write-Host "`n📊 Fetching dashboard stats..." -ForegroundColor Yellow
            $headers = @{ Authorization = "Bearer $token" }
            
            $dashboard = Invoke-RestMethod -Uri "$baseUrl/api/analytics/dashboard" `
                -Headers $headers
            
            Write-Host "`nDashboard Statistics:" -ForegroundColor Cyan
            Write-Host "  Events: $($dashboard.eventsCount)" -ForegroundColor Green
            Write-Host "  Users: $($dashboard.usersCount)" -ForegroundColor Green
            Write-Host "  Registrations: $($dashboard.registrationsCount)" -ForegroundColor Green
        }
        
        "4" {
            Write-Host "`n👋 Goodbye!" -ForegroundColor Cyan
            exit
        }
        
        default {
            Write-Host "Invalid choice" -ForegroundColor Red
        }
    }
}
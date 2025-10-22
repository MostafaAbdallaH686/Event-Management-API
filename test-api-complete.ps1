# ================================
# Event Management API Test Suite
# ================================

Write-Host "🧪 Event Management API - Complete Test Suite" -ForegroundColor Cyan
Write-Host "=" * 70

# Configuration
$baseUrl = "http://localhost:8080"

# Test 1: Health Check
Write-Host "`n1️⃣ Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health"
    Write-Host "   ✅ Status: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    Write-Host "`n⚠️  Make sure the server is running: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test 2: Login as Admin
Write-Host "`n2️⃣ Login as Admin..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "admin@eventmanagement.com"
        password = "Admin@123"
    } | ConvertTo-Json

    $adminResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody

    $adminToken = $adminResponse.token
    $adminId = $adminResponse.user.id
    Write-Host "   ✅ Logged in as: $($adminResponse.user.username)" -ForegroundColor Green
    Write-Host "   Role: $($adminResponse.user.role)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Login as Organizer
Write-Host "`n3️⃣ Login as Organizer..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "organizer@eventmanagement.com"
        password = "Organizer@123"
    } | ConvertTo-Json

    $organizerResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody

    $organizerToken = $organizerResponse.token
    $organizerId = $organizerResponse.user.id
    Write-Host "   ✅ Logged in as: $($organizerResponse.user.username)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 4: Login as Attendee
Write-Host "`n4️⃣ Login as Attendee..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "attendee@eventmanagement.com"
        password = "Attendee@123"
    } | ConvertTo-Json

    $attendeeResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody

    $attendeeToken = $attendeeResponse.token
    $attendeeId = $attendeeResponse.user.id
    Write-Host "   ✅ Logged in as: $($attendeeResponse.user.username)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 5: Get All Events
Write-Host "`n5️⃣ Get All Events (Public)..." -ForegroundColor Yellow
try {
    $events = Invoke-RestMethod -Uri "$baseUrl/api/events"
    Write-Host "   ✅ Found $($events.Count) event(s)" -ForegroundColor Green
    
    if ($events.Count -gt 0) {
        Write-Host "`n   Events:" -ForegroundColor Cyan
        foreach ($event in $events) {
            Write-Host "   - $($event.title)" -ForegroundColor Gray
            Write-Host "     Location: $($event.location)" -ForegroundColor DarkGray
        }
        $categoryId = $events[0].categoryId
        $existingEventId = $events[0].id
    }
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 6: Create Event (Organizer)
Write-Host "`n6️⃣ Create Event (Organizer)..." -ForegroundColor Yellow
try {
    $headers = @{
        Authorization = "Bearer $organizerToken"
    }

    $eventBody = @{
        title = "Test Event $(Get-Random -Maximum 1000)"
        description = "This is a test event created by the API test script"
        dateTime = (Get-Date).AddDays(30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        location = "Test Location - Virtual"
        maxAttendees = 50
        categoryId = $categoryId
        paymentRequired = $false
    } | ConvertTo-Json

    $newEvent = Invoke-RestMethod -Uri "$baseUrl/api/events" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $eventBody

    $newEventId = $newEvent.id
    Write-Host "   ✅ Event created: $($newEvent.title)" -ForegroundColor Green
    Write-Host "   ID: $newEventId" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Test 7: Register for Event (Attendee)
if ($newEventId) {
    Write-Host "`n7️⃣ Register for Event (Attendee)..." -ForegroundColor Yellow
    try {
        $headers = @{
            Authorization = "Bearer $attendeeToken"
        }

        $regBody = @{
            eventId = $newEventId
        } | ConvertTo-Json

        $registration = Invoke-RestMethod -Uri "$baseUrl/api/registrations" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $regBody

        $registrationId = $registration.id
        Write-Host "   ✅ Registered successfully" -ForegroundColor Green
        Write-Host "   Registration ID: $registrationId" -ForegroundColor Gray
        Write-Host "   Payment Status: $($registration.paymentStatus)" -ForegroundColor Gray
    } catch {
        Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 8: Admin Dashboard
Write-Host "`n8️⃣ Admin Dashboard..." -ForegroundColor Yellow
try {
    $headers = @{
        Authorization = "Bearer $adminToken"
    }

    $dashboard = Invoke-RestMethod -Uri "$baseUrl/api/analytics/dashboard" `
        -Headers $headers

    Write-Host "   ✅ Dashboard retrieved" -ForegroundColor Green
    Write-Host "   Total Events: $($dashboard.eventsCount)" -ForegroundColor Cyan
    Write-Host "   Total Users: $($dashboard.usersCount)" -ForegroundColor Cyan
    Write-Host "   Total Registrations: $($dashboard.registrationsCount)" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 9: Delete Event (Admin)
if ($newEventId) {
    Write-Host "`n9️⃣ Delete Event (Admin)..." -ForegroundColor Yellow
    try {
        $headers = @{
            Authorization = "Bearer $adminToken"
        }

        $result = Invoke-RestMethod -Uri "$baseUrl/api/events/$newEventId" `
            -Method DELETE `
            -Headers $headers

        Write-Host "   ✅ Event deleted" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n" + "=" * 70
Write-Host "✨ Testing Complete!" -ForegroundColor Green
Write-Host "`n📝 Access Tokens:" -ForegroundColor Cyan
Write-Host "`nAdmin:" -ForegroundColor Yellow
Write-Host $adminToken -ForegroundColor DarkGray
Write-Host "`nOrganizer:" -ForegroundColor Yellow
Write-Host $organizerToken -ForegroundColor DarkGray
Write-Host "`nAttendee:" -ForegroundColor Yellow
Write-Host $attendeeToken -ForegroundColor DarkGray
Write-Host ""
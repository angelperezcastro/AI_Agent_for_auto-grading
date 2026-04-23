import pytest


@pytest.mark.asyncio
async def test_register(client):
    response = await client.post(
        "/auth/register",
        json={
            "name": "Professor Demo",
            "email": "professor@example.com",
            "password": "Password123",
            "role": "professor",
        },
    )

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "Professor Demo"
    assert data["email"] == "professor@example.com"
    assert data["role"] == "professor"
    assert data["is_active"] is True
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_login(client):
    register_response = await client.post(
        "/auth/register",
        json={
            "name": "Student Demo",
            "email": "student@example.com",
            "password": "Password123",
            "role": "student",
        },
    )
    assert register_response.status_code == 201

    login_response = await client.post(
        "/auth/login",
        data={
            "username": "student@example.com",
            "password": "Password123",
        },
    )

    assert login_response.status_code == 200
    data = login_response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_bad_credentials(client):
    register_response = await client.post(
        "/auth/register",
        json={
            "name": "Another User",
            "email": "badlogin@example.com",
            "password": "Password123",
            "role": "student",
        },
    )
    assert register_response.status_code == 201

    login_response = await client.post(
        "/auth/login",
        data={
            "username": "badlogin@example.com",
            "password": "WrongPassword123",
        },
    )

    assert login_response.status_code == 401
    data = login_response.json()
    assert data["detail"] == "Incorrect email or password"
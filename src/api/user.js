export async function signUpUser(username, nickname, password, birthdate) {
    const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, nickname, password, birthdate })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
}

export async function loginUser(username, password) {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
}
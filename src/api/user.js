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
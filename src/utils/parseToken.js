const parseToken = (token) =>{
    const result = JSON.parse(token);
    return result.token;
}

export { parseToken };
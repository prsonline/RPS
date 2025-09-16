module.exports = function isStrongPassword(password) {
  // Yêu cầu: dài ít nhất 8 ký tự, gồm cả chữ hoa, thường, số, ký tự đặc biệt
  return (
    typeof password === 'string'
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  );
}

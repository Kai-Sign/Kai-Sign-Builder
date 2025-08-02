# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please email security@kai-sign-builder.com with details. Please do not create public GitHub issues for security vulnerabilities.

## Security Best Practices

### API Keys and Secrets

1. **Never commit API keys or secrets to the repository**
   - All sensitive credentials must be stored in environment variables
   - Use `.env` files for local development (never commit these)
   - Use `.env.example` as a template with placeholder values

2. **Environment Variables**
   - Required environment variables are documented in `.env.example`
   - Validate all environment variables at application startup
   - Use strong, unique values for all secrets

### CORS Configuration

- Configure CORS to only allow specific origins
- Never use wildcard (`*`) origins in production
- Update `ALLOWED_ORIGINS` in your environment variables

### API Security

1. **Rate Limiting**
   - Implement rate limiting on all API endpoints
   - Configure limits via environment variables

2. **Input Validation**
   - Validate all user inputs
   - Sanitize data before processing
   - Use parameterized queries for database operations

3. **Authentication & Authorization**
   - Implement proper authentication for sensitive endpoints
   - Use JWT tokens with appropriate expiration times
   - Validate permissions for each request

### Smart Contract Security

1. **Address Validation**
   - Always validate Ethereum addresses (42 characters, starts with 0x)
   - Verify contract addresses against known deployments
   - Implement checksums for address validation

2. **Transaction Security**
   - Validate all transaction parameters
   - Implement proper error handling for failed transactions
   - Use appropriate gas limits

### Dependencies

1. **Regular Updates**
   - Keep all dependencies up to date
   - Run `npm audit` regularly to check for vulnerabilities
   - Use dependabot or similar tools for automated updates

2. **Dependency Review**
   - Review all new dependencies before adding them
   - Prefer well-maintained packages with good security track records
   - Minimize the number of dependencies

### Data Protection

1. **Sensitive Data**
   - Never log sensitive information (API keys, user data, etc.)
   - Implement proper data encryption for stored data
   - Use HTTPS for all communications

2. **Error Handling**
   - Never expose internal error details to users
   - Log errors securely for debugging
   - Implement proper error boundaries

## Security Checklist

Before deploying to production:

- [ ] All API keys are stored in environment variables
- [ ] CORS is configured with specific allowed origins
- [ ] Rate limiting is enabled
- [ ] Input validation is implemented
- [ ] Error handling doesn't expose sensitive information
- [ ] All dependencies are up to date
- [ ] Security headers are configured
- [ ] HTTPS is enforced
- [ ] Logging doesn't contain sensitive data
- [ ] Environment variables are validated on startup

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Ethereum Smart Contract Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
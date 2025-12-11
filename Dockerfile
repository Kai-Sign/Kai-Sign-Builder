FROM python:3.12-slim

WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY backend/ .

# Expose port
EXPOSE 8000

# Set environment variables
ENV PORT=8000

# Run the FastAPI application using the start script
CMD ["python", "start.py"] 
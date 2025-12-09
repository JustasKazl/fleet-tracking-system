# ---- Base Python Image ----
FROM python:3.10

# ---- Set working directory ----
WORKDIR /app

# ---- Copy backend files ----
COPY backend/ ./backend/

# ---- Install dependencies ----
RUN pip install --no-cache-dir -r backend/requirements.txt

# ---- Expose port ----
ENV PORT=5000
EXPOSE 5000

# ---- Run backend ----
CMD ["python", "backend/app.py"]

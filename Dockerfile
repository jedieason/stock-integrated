FROM python:3.13-slim
WORKDIR /app
COPY index.html style.css app.js engine.js icons.js favicon.svg ./
COPY data/ ./data/
EXPOSE 5173
CMD ["python", "-m", "http.server", "5173", "--bind", "0.0.0.0"]

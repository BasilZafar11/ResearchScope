FROM python:3.12-slim
WORKDIR /app
COPY requirements-lock.txt .
RUN pip install --no-cache-dir -r requirements-lock.txt
COPY . .
RUN useradd --uid 10001 --create-home researchscope && mkdir /data && chown researchscope /data
USER 10001
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:////data/researchscope.db
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --no-access-log"]

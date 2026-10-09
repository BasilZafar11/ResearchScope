"""Track hosted Groq attempts independently of SerpApi."""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('groq_daily_budget', sa.Column('day_utc', sa.String(10), primary_key=True),
                    sa.Column('calls_used', sa.Integer(), nullable=False))


def downgrade():
    op.drop_table('groq_daily_budget')

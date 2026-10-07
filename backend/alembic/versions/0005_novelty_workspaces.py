"""Saved report review workspace and watch preferences."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

id_data = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), 'postgresql')
json_data = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql')


def upgrade():
    op.create_table('novelty_workspaces',
        sa.Column('report_id', id_data, primary_key=True),
        sa.Column('owner_token_hash', sa.String(64), nullable=False),
        sa.Column('review_token_hash', sa.String(64), nullable=False),
        sa.Column('comments', json_data, nullable=False),
        sa.Column('watched', sa.Boolean(), nullable=False),
        sa.Column('latest_report_id', id_data, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))


def downgrade():
    op.drop_table('novelty_workspaces')

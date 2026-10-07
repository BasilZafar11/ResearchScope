"""Add separate saved reports for the NoveltyMap workflow."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

json_data = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql')
id_data = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), 'postgresql')

def upgrade():
    op.create_table('novelty_reports',
        sa.Column('id', id_data, primary_key=True),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('title', sa.String(160), nullable=False),
        sa.Column('field', sa.String(160), nullable=False),
        sa.Column('input_data', json_data, nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('stage', sa.String(40), nullable=False),
        sa.Column('progress', sa.Integer(), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=False),
        sa.Column('report', json_data, nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_novelty_reports_fingerprint','novelty_reports',['fingerprint'])

def downgrade():
    op.drop_index('ix_novelty_reports_fingerprint', table_name='novelty_reports')
    op.drop_table('novelty_reports')

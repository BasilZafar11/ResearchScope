"""Add persistent per-IP and global daily hosted capacity accounting."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None

id_data = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), 'postgresql')

def upgrade():
    op.create_table('novelty_usage',
        sa.Column('id',id_data,primary_key=True), sa.Column('day_utc',sa.String(10),nullable=False),
        sa.Column('ip_hash',sa.String(64),nullable=False), sa.Column('analysis_id',id_data,nullable=False),
        sa.Column('calls_reserved',sa.Integer(),nullable=False), sa.Column('calls_used',sa.Integer(),nullable=False),
        sa.Column('status',sa.String(20),nullable=False), sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_novelty_usage_day_utc','novelty_usage',['day_utc'])
    op.create_index('ix_novelty_usage_ip_hash','novelty_usage',['ip_hash'])
    op.create_index('ix_novelty_usage_analysis_id','novelty_usage',['analysis_id'])
    op.create_table('novelty_daily_budget',sa.Column('day_utc',sa.String(10),primary_key=True),
        sa.Column('calls_reserved',sa.Integer(),nullable=False),sa.Column('calls_used',sa.Integer(),nullable=False))

def downgrade():
    op.drop_table('novelty_daily_budget')
    op.drop_index('ix_novelty_usage_analysis_id',table_name='novelty_usage')
    op.drop_index('ix_novelty_usage_ip_hash',table_name='novelty_usage')
    op.drop_index('ix_novelty_usage_day_utc',table_name='novelty_usage')
    op.drop_table('novelty_usage')

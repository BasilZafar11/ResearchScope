"""Initial immutable four-table schema."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Initial schema, frozen independently from application models.
    op.create_table('analyses',
    sa.Column('id', sa.String(length=36).with_variant(sa.UUID(as_uuid=False), 'postgresql'), nullable=False),
    sa.Column('fingerprint', sa.String(length=64), nullable=False),
    sa.Column('business_category', sa.String(length=80), nullable=False),
    sa.Column('city', sa.String(length=80), nullable=False),
    sa.Column('country', sa.String(length=80), nullable=False),
    sa.Column('keywords', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('known_competitors', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('stage', sa.String(length=30), nullable=False),
    sa.Column('progress', sa.Integer(), nullable=False),
    sa.Column('overall_score', sa.Integer(), nullable=True),
    sa.Column('confidence_score', sa.Integer(), nullable=True),
    sa.Column('interpretation', sa.String(length=40), nullable=True),
    sa.Column('recommendation', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('component_scores', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('warnings', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('sections', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('report', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('methodology_version', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_analyses_fingerprint'), 'analyses', ['fingerprint'], unique=False)
    op.create_index('uq_active_fingerprint', 'analyses', ['fingerprint'], unique=True, postgresql_where=sa.text("status IN ('queued', 'running')"), sqlite_where=sa.text("status IN ('queued', 'running')"))
    op.create_table('competitors',
    sa.Column('id', sa.String(length=36).with_variant(sa.UUID(as_uuid=False), 'postgresql'), nullable=False),
    sa.Column('analysis_id', sa.String(length=36).with_variant(sa.UUID(as_uuid=False), 'postgresql'), nullable=False),
    sa.Column('serpapi_data_id', sa.String(length=200), nullable=True),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('business_type', sa.Text(), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('rating', sa.Float(), nullable=True),
    sa.Column('review_count', sa.Integer(), nullable=False),
    sa.Column('price', sa.Text(), nullable=True),
    sa.Column('website', sa.Text(), nullable=True),
    sa.Column('rank', sa.Integer(), nullable=False),
    sa.Column('raw_subset', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_competitors_analysis_id'), 'competitors', ['analysis_id'], unique=False)
    op.create_table('signals',
    sa.Column('id', sa.String(length=36).with_variant(sa.UUID(as_uuid=False), 'postgresql'), nullable=False),
    sa.Column('analysis_id', sa.String(length=36).with_variant(sa.UUID(as_uuid=False), 'postgresql'), nullable=False),
    sa.Column('engine', sa.String(length=80), nullable=False),
    sa.Column('signal_type', sa.String(length=80), nullable=False),
    sa.Column('score', sa.Float(), nullable=True),
    sa.Column('payload', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_signals_analysis_id'), 'signals', ['analysis_id'], unique=False)
    op.create_table('evidence',
    sa.Column('id', sa.String(length=36).with_variant(sa.UUID(as_uuid=False), 'postgresql'), nullable=False),
    sa.Column('analysis_id', sa.String(length=36).with_variant(sa.UUID(as_uuid=False), 'postgresql'), nullable=False),
    sa.Column('competitor_id', sa.String(length=36).with_variant(sa.UUID(as_uuid=False), 'postgresql'), nullable=True),
    sa.Column('engine', sa.String(length=80), nullable=False),
    sa.Column('evidence_type', sa.String(length=40), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('snippet', sa.Text(), nullable=True),
    sa.Column('source_name', sa.Text(), nullable=True),
    sa.Column('source_url', sa.Text(), nullable=True),
    sa.Column('published_at', sa.String(length=80), nullable=True),
    sa.Column('metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['competitor_id'], ['competitors.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_evidence_analysis_id'), 'evidence', ['analysis_id'], unique=False)


def downgrade():
    # Initial schema, frozen independently from application models.
    op.drop_index(op.f('ix_evidence_analysis_id'), table_name='evidence')
    op.drop_table('evidence')
    op.drop_index(op.f('ix_signals_analysis_id'), table_name='signals')
    op.drop_table('signals')
    op.drop_index(op.f('ix_competitors_analysis_id'), table_name='competitors')
    op.drop_table('competitors')
    op.drop_index('uq_active_fingerprint', table_name='analyses', postgresql_where=sa.text("status IN ('queued', 'running')"), sqlite_where=sa.text("status IN ('queued', 'running')"))
    op.drop_index(op.f('ix_analyses_fingerprint'), table_name='analyses')
    op.drop_table('analyses')



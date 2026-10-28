-- Production RAG schema. pgvector objects are added by the migrator when the
-- extension is available; the base schema runs on any Postgres >= 14.

CREATE TABLE IF NOT EXISTS store_info (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id           text PRIMARY KEY,
  source       text NOT NULL,
  version      int  NOT NULL DEFAULT 1,
  content_hash text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id              text PRIMARY KEY,
  doc_id          text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  doc_version     int  NOT NULL,
  section_path    text NOT NULL,
  text            text NOT NULL,
  contextual_text text NOT NULL,
  embedding       double precision[] NOT NULL,
  token_count     int  NOT NULL,
  acl_groups      text[] NOT NULL DEFAULT ARRAY['public'],
  effective_date  date,
  tsv             tsvector GENERATED ALWAYS AS (to_tsvector('english', contextual_text)) STORED
);
CREATE INDEX IF NOT EXISTS chunks_doc_idx ON chunks(doc_id);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING gin(tsv);
CREATE INDEX IF NOT EXISTS chunks_acl_idx ON chunks USING gin(acl_groups);

CREATE TABLE IF NOT EXISTS traces (
  id          text PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  question    text NOT NULL,
  answer      text,
  refused     boolean NOT NULL DEFAULT false,
  versions    jsonb NOT NULL DEFAULT '{}',
  token_in    int NOT NULL DEFAULT 0,
  token_out   int NOT NULL DEFAULT 0,
  cost_est    double precision NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trace_spans (
  trace_id   text NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  stage      text NOT NULL,
  latency_ms double precision NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS spans_trace_idx ON trace_spans(trace_id);
CREATE INDEX IF NOT EXISTS spans_stage_idx ON trace_spans(stage);

CREATE TABLE IF NOT EXISTS eval_questions (
  id               text PRIMARY KEY,
  question         text NOT NULL,
  type             text NOT NULL,
  tier             text NOT NULL,
  source_doc       text NOT NULL,
  gold_quote       text NOT NULL DEFAULT '',
  reference_answer text NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id            text PRIMARY KEY,
  ts            timestamptz NOT NULL DEFAULT now(),
  tier          text NOT NULL,
  versions      jsonb NOT NULL DEFAULT '{}',
  n_questions   int  NOT NULL,
  recall_at_10  double precision,
  faithfulness  double precision,
  groundedness  double precision,
  abstention    double precision,
  p95_ms        double precision
);

CREATE TABLE IF NOT EXISTS eval_results (
  run_id         text NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  question_id    text NOT NULL,
  hit_at_10      boolean,
  retrieved_ids  text[] NOT NULL DEFAULT '{}',
  answer         text,
  faithfulness   double precision,
  groundedness   double precision,
  judge_reason   text,
  latency_ms     double precision,
  PRIMARY KEY (run_id, question_id)
);

CREATE TABLE IF NOT EXISTS failures (
  id                 text PRIMARY KEY,
  ts                 timestamptz NOT NULL DEFAULT now(),
  source             text NOT NULL, -- 'eval' | 'trace'
  ref_id             text,
  question           text,
  class              text NOT NULL, -- low_recall | hallucination | packing | stale
  detail             jsonb NOT NULL DEFAULT '{}',
  promoted_to_golden boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS failures_class_idx ON failures(class);

CREATE TABLE IF NOT EXISTS feedback (
  id       bigserial PRIMARY KEY,
  trace_id text NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  rating   int  NOT NULL CHECK (rating IN (-1, 1)),
  note     text,
  ts       timestamptz NOT NULL DEFAULT now()
);

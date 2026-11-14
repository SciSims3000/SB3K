# Authoring an SB3K activity

1. Copy [The Particle Model Quick Check](year7-particle-model.json) to a new JSON file under `activities/`.
2. Give it a unique, stable `activityId` such as `year7-mixtures`. Set the title, subject, year level, topic, version and mode. Keep the sample settings and student fields unless you intend to change how the activity runs.
3. Replace the sample questions. Each question needs a unique ID within the activity, type `mcq`, question text, distinct answer options, an `answer` that exactly matches one option, and a positive number of marks. Add a short explanation in `feedback`. For curriculum reporting, give each tag an `id` and a `name`. Reuse the same ID and name when several questions assess the same outcome.
4. Add an entry to [manifest.json](manifest.json). Its `id`, `title`, `subject` and `yearLevel` must match the activity file. Set `path` to the file's path from the site root, such as `activities/year7-mixtures.json`. The first entry is the homepage default.
5. From the repository root, run `python3 scripts/validate_activities.py` (Python 3.9 or newer). Fix any errors before publishing. Open the activity through the picker and check the questions and feedback. Its direct link ends in `?activity=year7-mixtures`.

Keep the activity ID stable when revising a quiz so existing links and reporting continue to identify it. Update the activity version when you revise the content.

For an optional question image, add an `image` object with `src` pointing to a raster image under `activities/` and `alt` describing the information students need. Add `caption` if useful. Leave out `image` for text-only questions.

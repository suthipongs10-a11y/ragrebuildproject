// Route table. Each entry lazily imports its page module so the browser only
// downloads what the visitor actually opens.

const page = (mod, fn = "render") => async (ctx) => (await import(mod))[fn](ctx);

export const routes = {
  "":         page("./pages/home.js"),

  monsters:   page("./pages/monsters.js", "list"),
  monster:    page("./pages/monsters.js", "detail"),

  items:      page("./pages/items.js", "list"),
  item:       page("./pages/items.js", "detail"),

  maps:       page("./pages/maps.js", "list"),
  map:        page("./pages/maps.js", "detail"),

  jobs:       page("./pages/jobs.js", "list"),
  job:        page("./pages/jobs.js", "detail"),

  skills:     page("./pages/skills.js", "list"),
  skill:      page("./pages/skills.js", "detail"),

  status:     page("./pages/status.js", "list"),
  shops:      page("./pages/shops.js", "list"),
  recipes:    page("./pages/recipes.js", "list"),
  charts:     page("./pages/charts.js", "render"),
  guide:      page("./pages/guide.js", "render"),
  health:     page("./pages/health.js", "list"),
};

# Product requirements and scope

User requirements take precedence: Taiwan first, light interface, functional integration of charting/screening/heatmaps/macro/portfolio research, GitHub repo `stock-integrated`, GitHub Pages deployment and Actions data access/update logic.

The supplied PAQRT directive is a long-term reference. This coherent first release implements its P0 data/chart/test foundation and useful P1 screening/portfolio/macro functions, plus an explicitly experimental deterministic research flow. It does not claim the entire production system, seven-stage model, licensed US dataset, advanced point-in-time infrastructure or broker connectivity is complete.

Primary workflow: overview -> identify sector/security -> open chart -> screen comparable securities -> compare assets -> configure and inspect a next-session-execution backtest -> produce evidence report -> set a local observation condition -> inspect data quality.

Default language Traditional Chinese, timezone Asia/Taipei, red up/green down. Original TWAVE branding. Small-screen navigation and data-table scrolling are supported. Each unavailable dataset is disclosed instead of rendered with demo observations.

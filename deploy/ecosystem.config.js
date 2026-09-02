module.exports = {
  apps: [
    {
      name: "jennifer-webmcp",
      script: "npm",
      args: "run start",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};

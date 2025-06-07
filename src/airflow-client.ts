import fetch from "node-fetch";

export interface AirflowConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  token?: string;
}

export class AirflowClient {
  private config: AirflowConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.AIRFLOW_BASE_URL || "http://localhost:8080",
      username: process.env.AIRFLOW_USERNAME,
      password: process.env.AIRFLOW_PASSWORD,
      token: process.env.AIRFLOW_TOKEN,
    };

    if (!this.config.token && (!this.config.username || !this.config.password)) {
      throw new Error(
        "Either AIRFLOW_TOKEN or both AIRFLOW_USERNAME and AIRFLOW_PASSWORD must be provided"
      );
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (this.config.token) {
      return {
        Authorization: `Bearer ${this.config.token}`,
      };
    } else if (this.config.username && this.config.password) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString("base64");
      return {
        Authorization: `Basic ${credentials}`,
      };
    }
    return {};
  }

  private async makeRequest(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.config.baseUrl}/api/v1${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airflow API error: ${response.status} ${response.statusText}: ${errorText}`);
    }

    return response.json();
  }

  async listDags(params: any = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());
    if (params.order_by) queryParams.append("order_by", params.order_by);

    const data = await this.makeRequest(`/dags?${queryParams}`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${data.total_entries} DAGs:\n\n${data.dags
            .map((dag: any) => 
              `• **${dag.dag_id}** - ${dag.description || "No description"}\n` +
              `  Status: ${dag.is_paused ? "Paused" : "Active"}\n` +
              `  Schedule: ${dag.schedule_interval || "None"}\n`
            )
            .join("\n")}`,
        },
      ],
    };
  }

  async getDag(dagId: string) {
    const data = await this.makeRequest(`/dags/${dagId}`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `**DAG: ${data.dag_id}**\n\n` +
            `Description: ${data.description || "No description"}\n` +
            `Status: ${data.is_paused ? "Paused" : "Active"}\n` +
            `Schedule: ${data.schedule_interval || "None"}\n` +
            `Start Date: ${data.start_date}\n` +
            `Catchup: ${data.catchup}\n` +
            `Max Active Runs: ${data.max_active_runs}\n` +
            `Tags: ${data.tags?.join(", ") || "None"}`,
        },
      ],
    };
  }

  async triggerDag(dagId: string, dagRunId?: string, conf?: any) {
    const payload: any = {};
    if (dagRunId) payload.dag_run_id = dagRunId;
    if (conf) payload.conf = conf;

    const data = await this.makeRequest(`/dags/${dagId}/dagRuns`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `DAG run triggered successfully!\n\n` +
            `DAG ID: ${data.dag_id}\n` +
            `Run ID: ${data.dag_run_id}\n` +
            `State: ${data.state}\n` +
            `Execution Date: ${data.execution_date}\n` +
            `Start Date: ${data.start_date || "Not started"}`,
        },
      ],
    };
  }

  async listDagRuns(dagId: string, params: any = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());

    const data = await this.makeRequest(`/dags/${dagId}/dagRuns?${queryParams}`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `DAG Runs for ${dagId} (${data.total_entries} total):\n\n${data.dag_runs
            .map((run: any) => 
              `• **${run.dag_run_id}**\n` +
              `  State: ${run.state}\n` +
              `  Start: ${run.start_date || "Not started"}\n` +
              `  End: ${run.end_date || "Running"}\n` +
              `  Duration: ${run.end_date && run.start_date ? 
                Math.round((new Date(run.end_date).getTime() - new Date(run.start_date).getTime()) / 1000) + "s" : 
                "N/A"}\n`
            )
            .join("\n")}`,
        },
      ],
    };
  }

  async getDagRun(dagId: string, dagRunId: string) {
    const data = await this.makeRequest(`/dags/${dagId}/dagRuns/${dagRunId}`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `**DAG Run: ${data.dag_run_id}**\n\n` +
            `DAG ID: ${data.dag_id}\n` +
            `State: ${data.state}\n` +
            `Start Date: ${data.start_date || "Not started"}\n` +
            `End Date: ${data.end_date || "Running"}\n` +
            `Duration: ${data.end_date && data.start_date ? 
              Math.round((new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / 1000) + "s" : 
              "N/A"}\n` +
            `External Trigger: ${data.external_trigger}\n` +
            `Configuration: ${data.conf ? JSON.stringify(data.conf, null, 2) : "None"}`,
        },
      ],
    };
  }

  async listTaskInstances(dagId: string, dagRunId: string) {
    const data = await this.makeRequest(`/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `Task Instances for ${dagId}/${dagRunId}:\n\n${data.task_instances
            .map((task: any) => 
              `• **${task.task_id}**\n` +
              `  State: ${task.state}\n` +
              `  Start: ${task.start_date || "Not started"}\n` +
              `  End: ${task.end_date || "Running"}\n` +
              `  Duration: ${task.duration ? Math.round(task.duration) + "s" : "N/A"}\n` +
              `  Try: ${task.try_number}\n`
            )
            .join("\n")}`,
        },
      ],
    };
  }

  async getTaskInstance(dagId: string, dagRunId: string, taskId: string) {
    const data = await this.makeRequest(`/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `**Task Instance: ${data.task_id}**\n\n` +
            `DAG ID: ${data.dag_id}\n` +
            `Run ID: ${data.dag_run_id}\n` +
            `State: ${data.state}\n` +
            `Start Date: ${data.start_date || "Not started"}\n` +
            `End Date: ${data.end_date || "Running"}\n` +
            `Duration: ${data.duration ? Math.round(data.duration) + "s" : "N/A"}\n` +
            `Try Number: ${data.try_number}\n` +
            `Max Tries: ${data.max_tries}\n` +
            `Queue: ${data.queue}\n` +
            `Pool: ${data.pool}\n` +
            `Priority Weight: ${data.priority_weight}`,
        },
      ],
    };
  }

  async pauseDag(dagId: string) {
    await this.makeRequest(`/dags/${dagId}?update_mask=is_paused`, {
      method: "PATCH",
      body: JSON.stringify({ is_paused: true }),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `DAG "${dagId}" has been paused successfully.`,
        },
      ],
    };
  }

  async unpauseDag(dagId: string) {
    await this.makeRequest(`/dags/${dagId}?update_mask=is_paused`, {
      method: "PATCH",
      body: JSON.stringify({ is_paused: false }),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `DAG "${dagId}" has been unpaused successfully.`,
        },
      ],
    };
  }
}
export class MetaAuthService {
  private static readonly GRAPH_API_URL = 'https://graph.facebook.com/v19.0';
  private static async parseJson<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
  }

  /**
   * For the POC, we simulate the token exchange flow.
   * In a real app, this would exchange a short-lived token for a long-lived one.
   */
  static async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.GRAPH_API_URL}/me?access_token=${token}`);
      return response.ok;
    } catch (error) {
      console.error('Meta Token Validation Error:', error);
      return false;
    }
  }

  static async getDebugToken(token: string, inputToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.GRAPH_API_URL}/debug_token?input_token=${inputToken}&access_token=${token}`);
    return this.parseJson<Record<string, unknown>>(response);
  }
}

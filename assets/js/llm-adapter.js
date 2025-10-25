// Optional LLM adapter. No secrets stored client-side.
// If window.COC_LLM_ENDPOINT is set (e.g., a serverless proxy),
// we POST to it. Otherwise we return safe mock suggestions.

export const llm = {
  available() {
    return typeof window !== 'undefined' && !!(window.COC_LLM_ENDPOINT && window.COC_LLM_ENDPOINT.trim());
  },

  async rephraseSituation(text) {
    if (!this.available()) {
      // simple mock: split long sentence into possible atomic rewrites
      const base = (text || '').trim();
      if (!base) return [];
      const suggestions = [
        base,
        base.replace(/and\s+/ig, '').trim(),
        base.replace(/too\s+many\s+/ig, 'many ').trim()
      ].filter((v, i, a) => v && a.indexOf(v) === i);
      return suggestions.slice(0, 3);
    }
    const res = await fetch(window.COC_LLM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'rephrase', text })
    });
    if (!res.ok) throw new Error('LLM endpoint error');
    const data = await res.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  },

  async suggestCauses(text) {
    if (!this.available()) {
      const base = (text || '').toLowerCase();
      const out = [];
      if (!base) return out;
      if (base.includes('tool') || base.includes('system')) out.push('Tooling or system constraints');
      if (base.includes('process') || base.includes('workflow')) out.push('Process ambiguity or handoffs');
      if (base.includes('time') || base.includes('delay')) out.push('Time constraints or bottlenecks');
      out.push('Missing ownership or unclear responsibilities');
      return out;
    }
    const res = await fetch(window.COC_LLM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'causes', text })
    });
    if (!res.ok) throw new Error('LLM endpoint error');
    const data = await res.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  }
};


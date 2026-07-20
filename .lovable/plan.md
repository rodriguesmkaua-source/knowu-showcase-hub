## Remover slide "Outro" do Fechamento Completo

**Problema:** No PDF/preview do Fechamento Consolidado aparece um slide extra ao final com título tipo "Fechamento — Julho" (sem operadora), listando apenas o tipo "Outro". Isso acontece porque, ao agrupar as demandas por operadora, qualquer demanda com `operadora` fora da lista canônica (ex. vazio, `"Outro"`, ou qualquer valor legado) cria uma entrada extra no mapa.

**Correção:** em `src/components/demandas/FechamentoModal.tsx`, no `useMemo` que monta `operadorasList` (linhas ~357-369), ignorar demandas cuja `operadora` não esteja em `OPERADORAS`. O mapa já é pré-populado com as operadoras canônicas, então basta trocar:

```ts
filtered.forEach((d) => {
  const arr = map.get(d.operadora) ?? [];
  arr.push(d);
  map.set(d.operadora, arr);
});
```

por:

```ts
filtered.forEach((d) => {
  const arr = map.get(d.operadora);
  if (!arr) return; // ignora operadora fora da lista canônica
  arr.push(d);
});
```

Assim o consolidado passa a ter exatamente 10 slides de operadora (+ capa), sem o slide fantasma de "Outro". Nenhuma outra tela é afetada — o filtro do dashboard, o Excel e o slide individual continuam iguais.

import { type PropertyStatementDto } from "@leilao-erp/types";
import type { CardsSection } from "../report-content.types";
import { formatPercentBR } from "../report-format";

const num = (value: string) => Number(value);
const pct = (value: string | null) => (value === null ? "—" : formatPercentBR(Number(value)));

/**
 * Cards-resumo da DRE conforme o momento do imóvel (mesma lógica da tela): antes da venda o rótulo é
 * "Capital investido", nunca "Lucro líquido"; vendido mostra o resultado realizado; cancelado, a perda.
 */
export function statementCards(statement: PropertyStatementDto, options: { sheet?: string } = {}): CardsSection {
  const { cards, mode, header } = statement;
  const sheet = options.sheet;

  if (mode === "VENDIDO") {
    return {
      kind: "cards",
      sheet,
      cards: [
        { label: "Capital investido", value: num(cards.capitalInvestido), format: "currency", subtitle: "Despesas realizadas" },
        { label: "Receitas realizadas", value: num(cards.receitasRealizadas), format: "currency", subtitle: "Venda e outras receitas" },
        {
          label: "Resultado realizado",
          value: num(cards.resultadoRealizado),
          format: "currency",
          highlight: true,
          subtitle: `Margem ${pct(cards.margemRealizadaPercentual)} sobre as receitas`,
        },
      ],
    };
  }

  if (mode === "CANCELADO") {
    return {
      kind: "cards",
      sheet,
      cards: [
        { label: "Capital investido", value: num(cards.capitalInvestido), format: "currency", subtitle: "Despesas realizadas" },
        { label: "Reembolsos", value: num(cards.reembolsos), format: "currency", subtitle: "Devolução da aquisição" },
        {
          label: "Resultado realizado (perda)",
          value: num(cards.resultadoRealizado),
          format: "currency",
          highlight: true,
          tone: num(cards.resultadoRealizado) < 0 ? "negative" : undefined,
          subtitle: header.canceladoEm ? "Aquisição cancelada" : undefined,
        },
      ],
    };
  }

  const avaliacao = cards.avaliacao === null ? { value: "Sem avaliação", format: "text" as const } : { value: num(cards.avaliacao), format: "currency" as const };
  if (mode === "OUTRO") {
    return {
      kind: "cards",
      sheet,
      cards: [
        { label: "Capital investido", value: num(cards.capitalInvestido), format: "currency", subtitle: "Despesas realizadas" },
        { label: "Avaliação Caixa", ...avaliacao },
      ],
    };
  }

  return {
    kind: "cards",
    sheet,
    cards: [
      { label: "Custo de aquisição", value: num(cards.custoAquisicao), format: "currency", subtitle: "Aquisição realizada" },
      { label: "Capital investido", value: num(cards.capitalInvestido), format: "currency", subtitle: "Despesas realizadas" },
      { label: "Avaliação Caixa", ...avaliacao, subtitle: cards.avaliacao === null ? "Fora da projeção" : undefined },
      { label: "Custos até a venda", value: num(cards.custosAteVenda), format: "currency", subtitle: "Previstos", tone: "forecast" },
      {
        label: "Resultado projetado",
        value: cards.resultadoProjetado === null ? "—" : num(cards.resultadoProjetado),
        format: cards.resultadoProjetado === null ? "text" : "currency",
        highlight: true,
        subtitle: `Margem ${pct(cards.margemPercentual)} · ROI ${pct(cards.roiPercentual)}`,
      },
    ],
  };
}

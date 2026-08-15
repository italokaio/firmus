import type { AuthenticatedUser } from "@leilao-erp/types";
import type { PropertyRowScope } from "../modules/properties/properties.service";

/**
 * Extrai o escopo por linha (Corretor/Investidor) do usuário autenticado —
 * usado pelos controllers de Imóveis/Vendas para restringir list/find aos
 * registros atribuídos/cadastrados por ele. Contas de equipe (sem
 * investorId/brokerId) resultam num escopo "vazio", sem restrição extra.
 */
export function rowScope(user: AuthenticatedUser): PropertyRowScope {
  return { userId: user.id, investorId: user.investorId, brokerId: user.brokerId };
}

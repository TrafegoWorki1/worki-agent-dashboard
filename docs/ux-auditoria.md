# Auditoria de UX — painel Worki Agent

Revisão de cada tela, coluna e recurso do painel, feita sobre a versão anterior
(tema claro) e a produção em `/servico`. Cada achado traz a gravidade, a
correção e onde ela está testada.

Gravidade: **alta** = induz a erro ou esconde problema real; **média** = atrapalha
a leitura ou a decisão; **baixa** = acabamento.

## Problemas que valem para o painel todo

| # | Achado | Gravidade | Correção |
|---|---|---|---|
| G1 | Listas longas sem paginação (até 200–300 linhas numa tela só) | alta | Paginação de **10 por página** em todas as listas (`src/lib/paginacao.ts`, `components/paginacao.tsx`). Página na URL, filtros preservados, âncora volta para a lista. Testes: `testes/paginacao.test.ts` |
| G2 | Carga limitada em silêncio: lista de 300 parecia ser "tudo" | alta | Quando o teto de carga é atingido, o rodapé avisa e a métrica fica em alerta |
| G3 | Texto sem acento ("Visao geral", "Aprovacoes", "ha", "execucao") | média | Todo texto visível em português correto |
| G4 | Horário só como "há 5 min": sem saber a hora exata | média | `<Tempo>`: "há 5 min" na tela, data e hora completas ao passar o mouse |
| G5 | Sem saber se a tela está atual | média | "Atualizado às HH:MM:SS" + botão **Atualizar** em toda página |
| G6 | Tema claro cansativo para painel de operação | média | Tema escuro com acento dourado; alerta é laranja, erro vermelho, para não se confundir com a marca |
| G7 | Status desconhecido aparecia como erro de schema mesmo sem dado | média | `tarefasComStatusDesconhecido` só alerta quando existe tarefa assim (antes: lista vazia disparava o alerta). Testes: `testes/exibicao.test.ts` |
| G8 | Texto longo cortado no meio da linha ou estourando a célula | média | `td.truncar` quebra palavras; textos longos são encurtados antes e o completo fica no `title` |
| G9 | Navegação plana, sem agrupamento | baixa | Menu em Operação / Atendimento / Registros, com ícones; no celular vira barra fixa |

## Por tela

### Login
| Achado | Gravidade | Correção |
|---|---|---|
| "Faça login" aparecia em vermelho para quem acabou de chegar | média | Estado "sem sessão" não é mais mostrado como erro |
| "Invalid login credentials" em inglês | média | "E-mail ou senha incorretos." (sem dizer qual dos dois) |

### Visão geral
| Achado | Gravidade | Correção |
|---|---|---|
| Status do serviço só dizia "enviada/falhou" (rótulo de entrega) | alta | "no ar" / "no ar, com restrições" / "fora do ar", considerando `/health` e `/ready` |
| Erro bruto do EasyPanel e dos logs na tela | alta | Mensagem com causa provável e o que fazer (`mensagemDeErroDoServico`) |
| "Aprovações aguardando" listava também as confirmadas | média | Renomeada para "Aprovações em aberto", com a cor de cada status |
| Tarefas recentes misturava concluídas e antigas | média | Mostra só as ativas |
| Sem caminho para o detalhe | média | "Ver todas →" em cada bloco |
| Legenda "Estados possíveis" ocupava espaço sem ajudar | baixa | Removida |

### Fila e entregas
| Coluna / bloco | Achado | Gravidade | Correção |
|---|---|---|---|
| Tempo de resposta | Mostrava só 20 mensagens; mediana frágil | média | Amostra de 50, paginada |
| Fila / Hermes / Envio / Total | Números alinhados à esquerda, difíceis de comparar | baixa | Alinhados à direita, fonte tabular |
| Entrada / Saída | Nomes internos | média | "Pedido" e "Resposta" |
| Mensagens esperando | "Motivo" em texto corrido | média | Chip azul (normal) ou vermelho (verificar) e link para a conversa |
| Respostas enviadas | Filtro em lista suspensa, exigia dois cliques | média | Abas por status; "incerto" explicado no cabeçalho |
| Enviada | Data sem hora relativa | baixa | Data e hora |

### Serviço e worker
| Bloco | Achado | Gravidade | Correção |
|---|---|---|---|
| Domínio | Estourava o cartão (visto em produção) | alta | Sem `https://`, quebra de linha, cartão largo |
| `/health` | JSON cru | média | Lista legível; booleanos viram chip sim/não |
| Logs | `fetch failed (BAD_REQUEST, HTTP 400)` exibido como se fosse log | alta | Detectado como erro (não como linha de log) e traduzido. Testes: `testes/servico.test.ts` |
| Métricas | `/ready` e latência duplicados com `/health` | baixa | Latência junto da métrica de cada endpoint |
| Parâmetros | Sem indicar se o valor veio do serviço ou do padrão | baixa | Chip "definido no serviço" / "padrão do código" |

### Conversas
| Achado | Gravidade | Correção |
|---|---|---|
| Só mensagens recebidas: parecia que o agente nunca respondia | alta | Linha do tempo dos dois lados, estilo chat; falha de envio aparece na resposta |
| Participante repetido em conversa direta | baixa | Só aparece em grupo |
| "Sessão" sem explicar | média | "vinculada / não vinculada — sem contexto retomável" |
| Seleção por lista suspensa | média | Linhas clicáveis, abas de período |

### Tarefas
| Achado | Gravidade | Correção |
|---|---|---|
| "Saídas recentes" dentro de Tarefas | média | Removida; vira o contador "Entregas incertas" com ligação à Fila |
| Métricas "Ativas no filtro" zeradas ao filtrar outro status | média | "No filtro / Ativas / Bloqueadas" |
| Coluna Projeto vazia em todas as linhas | baixa | Só aparece se alguma tarefa tem projeto |
| Detalhe abaixo da lista (fora da tela) | média | Detalhe acima da lista, com botão Fechar |
| Etapas sem limite | média | Paginadas (`p_etapas`) |
| Aba "Concluidas" etc. em lista suspensa | baixa | Abas |

### Aprovações
| Achado | Gravidade | Correção |
|---|---|---|
| Aba "Todas" não mostrava expiradas | alta | Renomeada "Em aberto" (o que a consulta realmente devolve) |
| Após aprovar, a linha seguia "aguardando" | alta | `router.refresh()` após sucesso |
| Palavra de confirmação por tentativa e erro | média | A tela diz qual palavra a ação exige |
| "sem conversa" sem explicação | média | "sem conversa vinculada: não dá para aprovar aqui" |
| Ação expirada sem orientação | média | "expirou — o agente precisa pedir de novo" |

### Memórias
| Achado | Gravidade | Correção |
|---|---|---|
| Menu de proprietário mostrava a chave de uma memória como se fosse o nome | alta | Mostra o número de WhatsApp formatado |
| Texto da barreira de isolamento repetido em três lugares | baixa | Um aviso só |
| Sem "Limpar filtros" | baixa | Botão |

### Auditoria
| Achado | Gravidade | Correção |
|---|---|---|
| Resultado desconhecido aparecia com "?" de erro de schema | média | Chip neutro |
| Duração em milissegundos crus | média | "850 ms", "12 s", "3 min 20 s" |
| Sem resumo | média | Registros, não bem-sucedidos, aguardaram aprovação, duração média |

## O que não mudou, de propósito

- Painel continua **somente leitura**; a única escrita é aprovar uma ação.
- Nenhum segredo novo é lido; EasyPanel segue com lista fechada de parâmetros.
- Paginação é em memória sobre listas já carregadas: não há consulta nova.

## Fora do alcance desta revisão

- Contagem real de registros acima do teto de carga (exigiria `count` extra por consulta).
- Atualização automática: hoje é manual, pelo botão.

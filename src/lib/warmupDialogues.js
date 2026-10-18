/**
 * Catálogo inicial com 35 diálogos naturais do dia a dia para Maturação / Aquecimento Cruzado de Chips.
 * Em cada diálogo:
 * - Índices pares (0, 2, 4...) são enviados pelo Chip A para o número do Chip B.
 * - Índices ímpares (1, 3, 5...) são a resposta enviada pelo Chip B para o número do Chip A.
 */
export const DEFAULT_WARMUP_DIALOGUES = [
  {
    id: 'default-1',
    title: 'Convite para a festa',
    category: 'Social',
    messages: [
      'Oi tudo bem?',
      'Tudo e vc?',
      'Tambem estou bem. Voce vai na festa?',
      'Vou sim e voce?',
      'Vou tambem, a gente se encontra la.',
    ],
  },
  {
    id: 'default-2',
    title: 'Combinando almoço',
    category: 'Cotidiano',
    messages: [
      'Bom dia! Tudo certo por ai?',
      'Bom dia, tudo tranquilo e com vc?',
      'Tudo otimo. Vamos almocar juntos hoje?',
      'Bora sim, meio dia no mesmo restaurante?',
      'Fechado, meio dia passo ai pra gente ir.',
    ],
  },
  {
    id: 'default-3',
    title: 'Churrasco no fim de semana',
    category: 'Social',
    messages: [
      'E ai, beleza?',
      'Beleza pura! Como estao as coisas?',
      'Tudo em paz. Vai rolar o churrasco no sabado mesmo?',
      'Vai sim, a partir das 13h la em casa.',
      'Show, pode deixar que eu levo a bebida.',
    ],
  },
  {
    id: 'default-4',
    title: 'Carona para o trabalho',
    category: 'Trabalho',
    messages: [
      'Oi, ja saiu de casa?',
      'Ainda nao, to terminando de tomar cafe.',
      'Consegue me dar uma carona hoje?',
      'Consigo sim, passo ai em 15 minutos.',
      'Perfeito, ja estou te esperando aqui na frente.',
    ],
  },
  {
    id: 'default-5',
    title: 'Partida de futebol',
    category: 'Esporte',
    messages: [
      'Fala amigo, tudo bem?',
      'Tudo joia e vc?',
      'Tudo certo. Confirmado o futebol hoje a noite?',
      'Confirmadissimo, quadra reservada para as 20h.',
      'Top demais, ate mais tarde entao!',
    ],
  },
  {
    id: 'default-6',
    title: 'Treino na academia',
    category: 'Saúde',
    messages: [
      'Oi! Vai treinar que horas hoje?',
      'Oi, estou pensando em ir la pelas 18h.',
      'Otimo, vou nesse horario tambem.',
      'Boa! A gente faz o treino juntos entao.',
      'Combinado, te vejo na recepcao as 18h.',
    ],
  },
  {
    id: 'default-7',
    title: 'Reunião da tarde',
    category: 'Trabalho',
    messages: [
      'Boa tarde, conseguiu revisar aquele documento?',
      'Boa tarde! Revise sim, ficou muito bom.',
      'Maravilha, a reuniao continua as 15h ne?',
      'Continua sim, na sala 2.',
      'Perfeito, nos vemos la.',
    ],
  },
  {
    id: 'default-8',
    title: 'Encomenda na portaria',
    category: 'Casa',
    messages: [
      'Oi, voce esta em casa agora?',
      'Estou sim, por que?',
      'O entregador disse que deixou um pacote na portaria.',
      'Ah verdade, acabei de pegar aqui com o porteiro.',
      'Que bom, obrigado por avisar!',
    ],
  },
  {
    id: 'default-9',
    title: 'Cinema à noite',
    category: 'Lazer',
    messages: [
      'Oi sumido, tudo bem?',
      'Oi! Tudo corrido mas tudo bem, e vc?',
      'Tudo certo. Anima ir no cinema hoje a noite?',
      'Animo demais, sessao das 20h30?',
      'Isso mesmo, ja vou garantir os nossos lugares.',
    ],
  },
  {
    id: 'default-10',
    title: 'Café da tarde',
    category: 'Cotidiano',
    messages: [
      'Ei, esta ocupado agora?',
      'Agora estou tranquilo, pode falar.',
      'Passei na padaria e trouxe pao de queijo, vem tomar cafe.',
      'Opa, cafe com pao de queijo eu nao recuso!',
      'Hahaha vem logo enquanto esta quentinho.',
    ],
  },
  {
    id: 'default-11',
    title: 'Aula da faculdade',
    category: 'Estudos',
    messages: [
      'Oi, voce foi na aula ontem?',
      'Fui sim, o professor passou materia nova.',
      'Depois voce me empresta o caderno pra eu tirar foto?',
      'Claro, hoje no intervalo eu te entrego.',
      'Valeu mesmo, salvou demais!',
    ],
  },
  {
    id: 'default-12',
    title: 'Aniversário da família',
    category: 'Família',
    messages: [
      'Oi, que horas a gente vai sair pro aniversario?',
      'Estou quase pronto, acho que umas 19h.',
      'Voce ja comprou o presente?',
      'Comprei ontem no shopping, ja esta ate embrulhado.',
      'Otimo, entao as 19h passo ai.',
    ],
  },
  {
    id: 'default-13',
    title: 'Chuva no caminho',
    category: 'Cotidiano',
    messages: [
      'Menino, esta chovendo ai no centro tambem?',
      'Esta caindo o mundo aqui agora!',
      'Melhor esperar diminuir antes de pegar a estrada.',
      'Sim, vou esperar meia horinha aqui.',
      'Isso, vai com cuidado quando sair.',
    ],
  },
  {
    id: 'default-14',
    title: 'Receita de bolo',
    category: 'Casa',
    messages: [
      'Oi! Aquele bolo de cenoura que vc fez ontem estava divino.',
      'Obrigada! Que bom que voce gostou.',
      'Depois me passa a receita da cobertura?',
      'Passo sim, e super facil de fazer.',
      'Oba, vou tentar fazer no domingo!',
    ],
  },
  {
    id: 'default-15',
    title: 'Viagem para a praia',
    category: 'Lazer',
    messages: [
      'E ai, tudo pronto pra viagem de sexta?',
      'Quase tudo, so falta arrumar a mala.',
      'Vamos sair bem cedinho pra fugir do transito?',
      'Com certeza, 6h da manha na estrada.',
      'Fechado, vou colocar o despertador.',
    ],
  },
  {
    id: 'default-16',
    title: 'Chave esquecida',
    category: 'Casa',
    messages: [
      'Oi, voce viu se minha chave ficou em cima da mesa?',
      'Deixa eu olhar aqui na sala.',
      'Tomara que esteja ai, nao achei na mochila.',
      'Achei! Esta do lado do controle da TV.',
      'Ufa, que alivio! Mais tarde pego ai.',
    ],
  },
  {
    id: 'default-17',
    title: 'Indicação de série',
    category: 'Lazer',
    messages: [
      'Terminou de assistir aquela serie que te indiquei?',
      'Terminei ontem a noite, que final foi aquele!',
      'Eu te falei que era muito boa.',
      'Agora preciso de outra recomendacao urgente.',
      'Vou separar mais duas otimas pra vc ver.',
    ],
  },
  {
    id: 'default-18',
    title: 'Mercado no fim do dia',
    category: 'Casa',
    messages: [
      'Oi, estou passando no supermercado agora. Precisa de algo?',
      'Oi! Que bom que avisou, acabou o leite e o cafe.',
      'Beleza, ja coloquei os dois no carrinho.',
      'Traga tambem frutas se estiverem bonitas.',
      'Pode deixar, daqui a 20 minutos chego em casa.',
    ],
  },
  {
    id: 'default-19',
    title: 'Manutenção do carro',
    category: 'Cotidiano',
    messages: [
      'Fala irmao, o mecanico ja entregou seu carro?',
      'Ja sim, busquei hoje cedo. Era so troca de oleo e filtro.',
      'Que bom, achou o preco dele justo?',
      'Muito honesto e rapido, recomendo.',
      'Depois me manda o contato dele pra eu levar o meu.',
    ],
  },
  {
    id: 'default-20',
    title: 'Pizza de sexta-feira',
    category: 'Social',
    messages: [
      'Sextou! Vamos pedir pizza hoje?',
      'Boa ideia, estou morrendo de fome.',
      'Meia calabresa e meia frango com catupiry?',
      'Perfeito, minha combinacao favorita.',
      'Acabei de pedir aqui, chega em 40 minutos.',
    ],
  },
  {
    id: 'default-21',
    title: 'Caminhada no parque',
    category: 'Saúde',
    messages: [
      'Bom dia! Animado pra caminhada hoje?',
      'Bom dia! Ja estou ate de tenis.',
      'O dia amanheceu bem fresquinho.',
      'Sim, clima perfeito pra dar duas voltas na lagoa.',
      'Te encontro na entrada principal em 10 minutos.',
    ],
  },
  {
    id: 'default-22',
    title: 'Passeio com o cachorro',
    category: 'Casa',
    messages: [
      'Oi, voce ja levou o Thor pra passear hoje?',
      'Levei cedo, mas ele ja quer sair de novo.',
      'Quando eu chegar do servico eu levo ele na praca.',
      'Beleza, ele fica todo feliz quando voce chega.',
      'Ate daqui a pouco entao!',
    ],
  },
  {
    id: 'default-23',
    title: 'Horário do dentista',
    category: 'Cotidiano',
    messages: [
      'Oi, sua consulta era hoje de manha ne?',
      'Era sim, acabei de sair do consultorio.',
      'Deu tudo certo la?',
      'Tudo tranquilo, foi so limpeza de rotina mesmo.',
      'Maravilha, nos falamos mais tarde.',
    ],
  },
  {
    id: 'default-24',
    title: 'Projeto entregue',
    category: 'Trabalho',
    messages: [
      'Parabens pela apresentacao de hoje cedo!',
      'Muito obrigado! Estava um pouco nervoso no comeco.',
      'Nem parecia, todo mundo elogiou bastante.',
      'Fico muito feliz em saber disso.',
      'Merece ate comemorar no happy hour sexta!',
    ],
  },
  {
    id: 'default-25',
    title: 'Jantar em família',
    category: 'Família',
    messages: [
      'Oi mae, tudo bem por ai?',
      'Tudo em paz meu filho, e com voce?',
      'Tudo bem tambem. Domingo vamos almocar ai?',
      'Claro, vou fazer aquela lasanha que voce gosta.',
      'Ai sim! Domingo as 11h estamos chegando.',
    ],
  },
  {
    id: 'default-26',
    title: 'Carregador emprestado',
    category: 'Trabalho',
    messages: [
      'Ei, voce trouxe seu carregador hoje?',
      'Trouxe sim, esta aqui na minha gaveta.',
      'Posso pegar emprestado por meia horinha? Meu celular esta em 5%.',
      'Pode pegar sim, fica a vontade.',
      'Show, ja devolvo rapidinho!',
    ],
  },
  {
    id: 'default-27',
    title: 'Jogo na TV',
    category: 'Esporte',
    messages: [
      'Vai assistir o jogo hoje a noite?',
      'Com certeza, hoje e decisao!',
      'Vem assistir aqui em casa, fiz petiscos.',
      'Fechou! Chego ai uns 15 minutos antes do jogo comecar.',
      'Beleza, a porta ja esta aberta.',
    ],
  },
  {
    id: 'default-28',
    title: 'Feira de domingo',
    category: 'Casa',
    messages: [
      'Bom dia! Ja esta na feira?',
      'Acabei de chegar aqui na barraca do pastel.',
      'Traz um de queijo e caldo de cana pra mim?',
      'Trago sim, ja pedi o seu.',
      'Voce e nota dez, obrigada!',
    ],
  },
  {
    id: 'default-29',
    title: 'Estudo para prova',
    category: 'Estudos',
    messages: [
      'E ai, como estao os estudos pra prova de amanha?',
      'Revisando os ultimos capitulos agora.',
      'Acha que vai cair mais a parte pratica?',
      'Com certeza, o professor focou bastante nisso.',
      'Verdade, vou revisar os exercicios entao. Boa sorte pra nos!',
    ],
  },
  {
    id: 'default-30',
    title: 'Mudança de apartamento',
    category: 'Social',
    messages: [
      'Oi! Como foi a mudanca ontem?',
      'Cansativa demais, mas ja estamos no apartamento novo!',
      'Que bencao! Precisa de ajuda pra organizar as caixas?',
      'O grosso ja foi, agora queremos fazer um cafe pra receber vcs.',
      'Oba, avisa o dia que nos vamos com certeza!',
    ],
  },
  {
    id: 'default-31',
    title: 'Show no sábado',
    category: 'Lazer',
    messages: [
      'Oi! Conseguiu pegar os ingressos pro show?',
      'Consegui sim, comprei no primeiro lote.',
      'Menos mal, ouvi dizer que ja esta quase esgotando.',
      'Pois e, demos muita sorte.',
      'Sabado vai ser inesquecivel!',
    ],
  },
  {
    id: 'default-32',
    title: 'Conserto da internet',
    category: 'Casa',
    messages: [
      'A internet la de casa ja voltou ao normal?',
      'Voltou agora pouco, o tecnico trocou o roteador.',
      'Esta rapida agora?',
      'Bem melhor, o sinal esta pegando ate na varanda.',
      'Otimo, hoje consigo trabalhar de casa tranquilo.',
    ],
  },
  {
    id: 'default-33',
    title: 'Lanche da tarde',
    category: 'Trabalho',
    messages: [
      'Bateu uma fome aqui agora, vamos descer na lanchonete?',
      'Vamos! Tambem preciso esticar as pernas.',
      'Me encontra perto do elevador?',
      'Sim, estou salvando o arquivo aqui e ja vou.',
      'Beleza, te espero la.',
    ],
  },
  {
    id: 'default-34',
    title: 'Clima de feriado',
    category: 'Social',
    messages: [
      'Finalmente vespera de feriado!',
      'Nem me fale, estava precisando descansar.',
      'Vai viajar ou ficar pela cidade mesmo?',
      'Vou ficar por aqui mesmo pra descansar bastante.',
      'Faz muito bem, bom feriado pra voce!',
    ],
  },
  {
    id: 'default-35',
    title: 'Encontro na praça',
    category: 'Cotidiano',
    messages: [
      'Oi, ja cheguei aqui perto da praca.',
      'Onde voce esta sentado?',
      'Perto do quiosque de sorvete, de camisa azul.',
      'Ja te vi! Estou atravessando a rua.',
      'Beleza, te espero aqui.',
    ],
  },
];

/**
 * Normaliza um número de telefone para envio no Android (ex: garante DDI 55 se tiver 10/11 dígitos).
 */
export function normalizeChipPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Extrai a lista de chips ativos que possuem número de telefone preenchido,
 * respeitando se o plano permite Dual-SIM ou apenas SIM 1.
 */
export function getActiveConfiguredChips(devices = [], singleSimOnly = false) {
  const chips = [];
  for (const d of devices) {
    const p1 = normalizeChipPhone(d.sim1_phone);
    if (p1.length >= 10) {
      chips.push({
        key: `${d.id}:0`,
        deviceId: d.id,
        deviceName: d.name || d.id,
        simSlot: 0,
        operator: d.sim1_operator || 'SIM 1',
        phone: p1,
        status: d.status,
      });
    }
    if (!singleSimOnly) {
      const p2 = normalizeChipPhone(d.sim2_phone);
      if (p2.length >= 10) {
        chips.push({
          key: `${d.id}:1`,
          deviceId: d.id,
          deviceName: d.name || d.id,
          simSlot: 1,
          operator: d.sim2_operator || 'SIM 2',
          phone: p2,
          status: d.status,
        });
      }
    }
  }
  return chips;
}

/**
 * Forma duplas de chips para conversarem entre si.
 * - Se houver 2 chips (ex: Chip 1 e Chip 2), forma 1 dupla [Chip 1 <-> Chip 2].
 * - Se houver 3 chips, forma um anel para que todos conversem: [1<->2], [2<->3], [3<->1].
 * - Se houver 4+ chips em número par, forma duplas diretas + cruzadas.
 */
export function buildChipPairs(chips = []) {
  if (chips.length < 2) return [];
  if (chips.length === 2) {
    return [[chips[0], chips[1]]];
  }
  const pairs = [];
  for (let i = 0; i < chips.length; i += 2) {
    if (i + 1 < chips.length) {
      pairs.push([chips[i], chips[i + 1]]);
    } else {
      // Número ímpar de chips: o último também conversa com o primeiro
      pairs.push([chips[i], chips[0]]);
    }
  }
  return pairs;
}

/**
 * Gera os registros para `sms_schedule` (ou `sms_queue`) para as duplas de chips.
 * - `mode === 'now'`: inicia o 1º diálogo imediatamente e espaça cada fala de resposta em 2 a 4 minutos.
 * - `mode === 'daily'`: distribui `dialoguesPerPair` diálogos ao longo do dia (ex: a cada 2h~3h) e
 *   espaça cada fala da conversa em 2 a 4 minutos.
 */
export function buildWarmupScheduleRows({
  userId,
  pairs = [],
  dialogues = DEFAULT_WARMUP_DIALOGUES,
  dialoguesPerPair = 3,
  mode = 'now', // 'now' | 'daily'
}) {
  if (!userId || !pairs.length || !dialogues.length) return [];

  const pool = dialogues.filter((d) => Array.isArray(d.messages) && d.messages.length >= 2);
  if (!pool.length) return [];

  const rows = [];
  const baseNow = Date.now();
  const countPerPair = mode === 'now' ? 1 : Math.max(1, Number(dialoguesPerPair) || 3);

  pairs.forEach(([chipA, chipB], pairIdx) => {
    // Embaralha os diálogos para não repetir na mesma dupla
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    for (let dIdx = 0; dIdx < countPerPair; dIdx++) {
      const dialogue = shuffled[dIdx % shuffled.length];
      // Se for 'now', começa em 5 segundos (+ 30s por dupla).
      // Se for 'daily', distribui cada diálogo em blocos de ~2h a 3h ao longo do dia.
      const dialogueOffsetSec =
        mode === 'now'
          ? 5 + pairIdx * 20
          : dIdx * (7200 + Math.floor(Math.random() * 1800)) + pairIdx * 120;

      let turnTimeMs = baseNow + dialogueOffsetSec * 1000;

      dialogue.messages.forEach((rawText, turnIdx) => {
        const text = String(rawText || '').trim();
        if (!text) return;

        // Turnos pares (0, 2, 4): Chip A envia para o telefone do Chip B
        // Turnos ímpares (1, 3, 5): Chip B responde para o telefone do Chip A
        const sender = turnIdx % 2 === 0 ? chipA : chipB;
        const receiver = turnIdx % 2 === 0 ? chipB : chipA;

        if (turnIdx > 0) {
          // Intervalo humano entre pergunta e resposta: entre 90s e 210s (1.5 a 3.5 min)
          const replyDelaySec = 90 + Math.floor(Math.random() * 120);
          turnTimeMs += replyDelaySec * 1000;
        }

        rows.push({
          user_id: userId,
          campaign_id: null,
          target_device_id: sender.deviceId,
          sim_slot: sender.simSlot,
          phone: receiver.phone,
          message: text,
          scheduled_for: new Date(turnTimeMs).toISOString(),
          status: 'WAITING',
        });
      });
    }
  });

  return rows;
}


// ==========================================================================
// BlueGift | Loveify - app.js (VERSÃO DE PRODUÇÃO CONSOLIDADA CORRIGIDA)
// Expert: Arquitetura Estável, Sincronização Robusta e Áudio Completo.
// ==========================================================================

// ==========================================
// 0. CONFIGURAÇÃO E CONEXÃO COM O SUPABASE
// ==========================================
const SUPABASE_URL = "https://dslfazlbihgswdepmekl.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_CFx8YSapW8FF4VvJ72HIww_S5u13Jl1"; 

// Instância única e global do cliente Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. VARIÁVEIS DE ESTADO E MAPEAMENTO DOM
// ==========================================
let currentStep = 1;
const totalSteps = 6;

// --- Elementos de Controle do Wizard ---
const btnVoltar = document.getElementById('btn-voltar');
const btnAvancar = document.getElementById('btn-avancar');
const btnPrevia = document.getElementById('btn-previa');
const stepIndicator = document.getElementById('step-indicator');
const progressBar = document.getElementById('progress-bar');
const previewSection = document.getElementById('preview-section');
const btnPlayPause = document.getElementById('btn-play-pause'); // Declarado aqui globalmente

// --- Todos os Inputs do Formulário ---
const inputSeuNome = document.getElementById('input-seu-nome');
const inputAmorNome = document.getElementById('input-amor-nome');
const inputData = document.getElementById('input-data');
const inputTitulo = document.getElementById('input-titulo');
const inputBuscaMusica = document.getElementById('input-busca-musica'); // Input de pesquisa
const inputNomeMusica = document.getElementById('input-nome-musica');   // Input de exibição/edição
const inputFotos = document.getElementById('input-fotos');
const inputMensagem = document.getElementById('input-mensagem');

// --- Elementos do Mockup (Prévia Smartphone) ---
const previewTituloTop = document.getElementById('preview-titulo');
const previewTrackName = document.getElementById('preview-track-name');
const previewCasal = document.getElementById('preview-casal');
const previewMensagem = document.getElementById('preview-mensagem');
const previewFotoPlaceholder = document.getElementById('preview-foto-placeholder');
const carouselContainer = document.getElementById('carousel-container');
const carouselDots = document.getElementById('carousel-dots');
const listaResultadosMusica = document.getElementById('lista-resultados-musica');

// --- Variáveis de Estado do Áudio (YouTube Mascarado) ---
let ytPlayerObjeto = null; 
let intervaloProgressoAudio = null;
let listaVideosAlternativos = [];
let indiceVideoAtual = 0;

// Dados estruturados da música selecionada para persistência no banco
let musicaSelecionadaDados = {
    nome: "",
    artista: "",
    youtube_busca_termo: "" // Salvaremos o termo exato de busca para o embed
};

// ==========================================
// FUNÇÃO AUXILIAR: CONTROLE VISUAL BLINDADO
// ==========================================
// Essa função limpa o botão e garante que os ícones NUNCA se acumulem
function alternarVisualBotao(estaTocando) {
    const btn = document.getElementById('btn-play-pause');
    if (!btn) return;
    
    if (estaTocando) {
        btn.innerHTML = '<i class="fas fa-pause text-xl"></i>';
    } else {
        btn.innerHTML = '<i class="fas fa-play text-xl ml-0.5"></i>';
    }
}

// ==========================================
// 2. LÓGICA DO WIZARD (FLUXO DO FORMULÁRIO)
// ==========================================
function updateSteps() {
    // Atualiza os textos e barra de progresso do topo
    if (stepIndicator) stepIndicator.innerText = `Passo ${currentStep} de ${totalSteps}`;
    const progressPercent = (currentStep / totalSteps) * 100;
    if (progressBar) progressBar.style.width = `${progressPercent}%`;

    // Gerencia visibilidade dos conteúdos dos passos
    document.querySelectorAll('.step-content').forEach(step => {
        step.classList.add('hidden');
    });
    
    const currentStepEl = document.getElementById(`step-${currentStep}`);
    if (currentStepEl) currentStepEl.classList.remove('hidden');

    // Controla o estado e texto dos botões de navegação
    btnVoltar.disabled = (currentStep === 1);
    btnAvancar.innerText = (currentStep === totalSteps) ? "Concluir" : "Avançar";
}

// --- Evento do Botão Avançar / Concluir ---
btnAvancar.addEventListener('click', async () => {
    if (currentStep < totalSteps) {
        currentStep++;
        updateSteps();
    } else {
        // --- Ação de Conclusão e Salvamento no Supabase ---
        
        // Validação básica de segurança
        if (!inputSeuNome.value.trim() || !inputAmorNome.value.trim() || !inputData.value) {
            alert("Por favor, preencha pelo menos os nomes e a data antes de concluir!");
            return;
        }

        try {
            // UI State: Bloqueia botão para evitar cliques duplos
            btnAvancar.disabled = true;
            btnAvancar.innerText = "Processando...";

            const files = inputFotos.files;
            const fotosUrlsSalvas = [];

            // --- FLUXO 1: Upload de Imagens para o Storage ---
            if (files.length > 0) {
                const maxFotos = Math.min(files.length, 5);
                for (let i = 0; i < maxFotos; i++) {
                    const file = files[i];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                    const filePath = `capas/${fileName}`;

                    let { error: uploadError } = await supabaseClient.storage
                        .from('fotos-presentes')
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const { data: publicUrlData } = supabaseClient.storage
                        .from('fotos-presentes')
                        .getPublicUrl(filePath);

                    fotosUrlsSalvas.push(publicUrlData.publicUrl);
                }
            }

            // --- FLUXO 2: Persistência de Dados na Tabela 'presentes' ---
            const dadosDoPresente = {
                seu_nome: inputSeuNome.value.trim(),
                amor_nome: inputAmorNome.value.trim(),
                data_inicio: new Date(inputData.value).toISOString(),
                titulo: inputTitulo.value.trim() || "Nossa Playlist de Amor",
                musica_url: musicaSelecionadaDados.youtube_busca_termo || "", 
                nome_musica: inputNomeMusica.value.trim() || "Nossa Música",
                mensagem: inputMensagem.value.trim(),
                fotos_urls: fotosUrlsSalvas 
            };

            const { data, error } = await supabaseClient
                .from('presentes')
                .insert([dadosDoPresente])
                .select();

            if (error) throw error;

            // --- FLUXO 3: Redirecionamento para Checkout ---
            if (data && data[0]) {
                const presenteCriado = data[0];
                window.location.href = `planos.html?id=${presenteCriado.id}`;
            } else {
                throw new Error("Falha na persistência: Nenhum dado retornado.");
            }

        } catch (error) {
            console.error("Erro crítico no processo de conclusão:", error);
            alert("Houve um erro ao salvar o seu presente. Por favor, verifique os dados e tente novamente.");
            btnAvancar.disabled = false;
            btnAvancar.innerText = "Concluir";
        }
    }
});

// --- Evento do Botão Voltar ---
btnVoltar.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        updateSteps();
    }
});

// --- Suporte Mobile: Rolagem para Prévia ---
if (btnPrevia) {
    btnPrevia.addEventListener('click', () => {
        if (previewSection) previewSection.scrollIntoView({ behavior: 'smooth' });
    });
}


// ==========================================
// 3. MOTOR DE SINCRONIZAÇÃO EM TEMPO REAL (LIVE PREVIEW)
// ==========================================
function atualizarNomesPreview() {
    const seuNome = inputSeuNome.value.trim();
    const amorNome = inputAmorNome.value.trim();
    
    if (previewCasal) {
        if (seuNome && amorNome) {
            previewCasal.innerText = `${seuNome} & ${amorNome}`;
        } else if (seuNome || amorNome) {
            previewCasal.innerText = seuNome || amorNome;
        } else {
            previewCasal.innerText = "Gabriel & Mariana"; 
        }
    }
}

inputSeuNome.addEventListener('input', atualizarNomesPreview);
inputAmorNome.addEventListener('input', atualizarNomesPreview);

inputTitulo.addEventListener('input', () => {
    if (previewTituloTop) {
        previewTituloTop.innerText = inputTitulo.value.trim() || "Nossa Playlist de Amor";
    }
});

inputMensagem.addEventListener('input', () => {
    if (previewMensagem) {
        previewMensagem.innerText = inputMensagem.value.trim() ? inputMensagem.value.trim() : `"Sua mensagem carinhosa aparecerá bem aqui..."`;
    }
});

inputNomeMusica.addEventListener('input', () => {
    if (previewTrackName) {
        previewTrackName.innerText = inputNomeMusica.value.trim() || "Nossa Playlist de Amor";
    }
});


// ==========================================================================
// 4. MOTOR DE ÁUDIO PROFISSIONAL (SPOTIFY SEARCH + YOUTUBE MASCARADO)
// ==========================================================================
const SPOTIFY_CLIENT_ID = "28fc1438575a436c9c9701fd4f7a56a3";
const SPOTIFY_CLIENT_SECRET = "61539570971046c1a112aad40a123d7d";
const YOUTUBE_API_KEY = "AIzaSyDZwWn8Fvpf6r_wmJfsrAauIJFkAyJsyyw"; 
let spotifyAccessToken = "";

async function obterSpotifyToken() {
    if (spotifyAccessToken) return spotifyAccessToken;
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
            },
            body: 'grant_type=client_credentials'
        });
        const data = await response.json();
        spotifyAccessToken = data.access_token;
        return spotifyAccessToken;
    } catch (err) {
        console.error("Falha ao obter token Spotify:", err);
        return null;
    }
}

let timeoutDebounceBusca = null;
inputBuscaMusica.addEventListener('input', () => {
    clearTimeout(timeoutDebounceBusca);
    const termo = inputBuscaMusica.value.trim();
    
    if (termo.length < 2) {
        if (listaResultadosMusica) listaResultadosMusica.classList.add('hidden');
        return;
    }

    timeoutDebounceBusca = setTimeout(async () => {
        try {
            const token = await obterSpotifyToken();
            if (!token) return;

            const urlBusca = `https://api.spotify.com/v1/search?q=$${encodeURIComponent(termo)}&type=track&limit=5`;
            
            const res = await fetch(urlBusca, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.tracks && data.tracks.items) {
                renderizarResultadosSpotify(data.tracks.items);
            }
        } catch (err) {
            console.error("Erro na execução da busca Spotify:", err);
        }
    }, 400);
});

function renderizarResultadosSpotify(tracks) {
    listaResultadosMusica.innerHTML = '';
    if (!tracks || tracks.length === 0) {
        listaResultadosMusica.classList.add('hidden');
        return;
    }

    tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer transition text-left text-slate-800";
        
        const capaImg = track.album.images[2]?.url || '';
        const nomeMusica = track.name;
        const artista = track.artists.map(a => a.name).join(', ');

        item.innerHTML = `
            <img src="${capaImg}" class="w-10 h-10 rounded object-cover">
            <div class="truncate flex-1">
                <p class="text-xs font-bold truncate">${nomeMusica}</p>
                <p class="text-[10px] text-slate-400 truncate">${artista}</p>
            </div>
        `;

        item.addEventListener('click', async () => {
            const termoBuscaYT = `${nomeMusica} ${artista} official audio`;
            inputNomeMusica.value = `${nomeMusica} - ${artista}`;

            const elementoNomePreview = document.getElementById('preview-nome-musica');
            const elementoArtistaPreview = document.getElementById('preview-artista-musica');
            const elementoCapaPreview = document.getElementById('preview-capa-musica');

            if (elementoNomePreview) elementoNomePreview.textContent = nomeMusica;
            if (elementoArtistaPreview) elementoArtistaPreview.textContent = artista;
            if (elementoCapaPreview && track.album.images[0]?.url) {
                elementoCapaPreview.src = track.album.images[0].url;
            }
            
            listaResultadosMusica.classList.add('hidden');
            inputBuscaMusica.value = '';

            try {
                const urlAPI = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(termoBuscaYT)}&type=video&videoEmbeddable=true&key=${YOUTUBE_API_KEY}&maxResults=5`;
                
                const res = await fetch(urlAPI);
                
                if (!res.ok) {
                    throw new Error(`Erro na API Oficial: ${res.status}`);
                }

                const data = await res.json();
                const videoId = data.items[0]?.id?.videoId;

                if (videoId) {
                    musicaSelecionadaDados = { nome: nomeMusica, artista: artista, youtube_id: videoId };
                    carregarYoutubePlayerInvisivel(videoId);
                } else {
                    alert("Não encontramos um vídeo correspondente no YouTube para esta música.");
                }

            } catch (err) {
                console.error("Erro na busca oficial do YouTube:", err);
                alert("Falha ao sincronizar o áudio. Verifique se a sua chave (API Key) do YouTube está correta e ativa.");
            }
        });
        listaResultadosMusica.appendChild(item);
    });

    listaResultadosMusica.classList.remove('hidden');
}

function carregarYoutubePlayerInvisivel(videoId) {
    if (ytPlayerObjeto && typeof ytPlayerObjeto.loadVideoById === 'function') {
        ytPlayerObjeto.loadVideoById(videoId);
        return;
    }

    let containerFalso = document.getElementById('yt-player-invisivel-container');
    
    if (!containerFalso) {
        containerFalso = document.createElement('div');
        containerFalso.id = 'yt-player-invisivel-container';
        containerFalso.style.position = 'fixed';
        containerFalso.style.bottom = '10px';
        containerFalso.style.right = '10px';
        containerFalso.style.width = '200px';
        containerFalso.style.height = '200px';
        containerFalso.style.zIndex = '-1';
        containerFalso.style.pointerEvents
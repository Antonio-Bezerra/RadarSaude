const ubsGrid = document.getElementById('ubs-grid');
const loader = document.getElementById('loading');
const btnGps = document.getElementById('btn-gps');
const btnCep = document.getElementById('btn-cep');
const inputCep = document.getElementById('input-cep');
const statusTexto = document.getElementById('location-status');

const API_BASE_URL = 'https://5us3clhmzb.execute-api.us-east-1.amazonaws.com/default';
const LIMITE_RESULTADOS = 15;


function alternarEstadoCarregamento(carregando) {
  if (carregando) {
    loader.classList.remove('hidden');
    btnGps.disabled = true;
    btnCep.disabled = true;
    ubsGrid.innerHTML = '';
  } else {
    loader.classList.add('hidden');
    btnGps.disabled = false;
    btnCep.disabled = false;
  }
}

async function fetchUbsProximas(lat, lon) {
  const url = `${API_BASE_URL}/ubs-proximas?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&limite=${LIMITE_RESULTADOS}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`API respondeu com status ${response.status}`);
  }

  const dados = await response.json();
  return Array.isArray(dados) ? dados : (dados.ubs || []);
}

async function processarEExibirMaisProximas(userLat, userLon) {
  alternarEstadoCarregamento(true);

  try {
    const proximas = await fetchUbsProximas(userLat, userLon);
    alternarEstadoCarregamento(false);
    renderizarUbs(proximas);
    statusTexto.textContent = 'UBSs encontradas';

  } catch (error) {
    alternarEstadoCarregamento(false);
    ubsGrid.innerHTML = '<p>Não foi possível carregar as UBS no momento. Tente novamente em instantes.</p>';
    statusTexto.textContent = "Erro ao buscar as unidades mais próximas.";
    console.error('Falha ao consultar a API de UBS:', error);
  }
}

function renderizarUbs(lista) {
  if (!lista || lista.length === 0) {
    ubsGrid.innerHTML = '<p>Nenhuma unidade encontrada próxima a essa região.</p>';
    return;
  }

  lista.forEach(ubs => {
    const distanciaTexto = typeof ubs.distanciaKm === 'number'
      ? `${ubs.distanciaKm.toFixed(2)} km`
      : 'distância não informada';

    const card = document.createElement('article');
    card.classList.add('ubs-card');
    card.innerHTML = `
      <div>
        <h3>${ubs.nome || 'Unidade sem Nome'}</h3>
        <div class="ubs-info">
          <p><strong>Endereço:</strong> ${ubs.logradouro || 'Não informado'}</p>
          <p><strong>Bairro:</strong> ${ubs.bairro || 'Não informado'}</p>
          <p style="color: #16a34a; font-weight: bold; margin-top: 8px;">
            📍 Aproximadamente ${distanciaTexto} de você
          </p>
        </div>
      </div>
      <span class="ubs-badge">CNES: ${ubs.cnes || 'N/A'}</span>
    `;
    ubsGrid.appendChild(card);
  });
}

btnGps.addEventListener('click', () => {
  if (!navigator.geolocation) {
    statusTexto.textContent = "Seu navegador não suporta geolocalização.";
    return;
  }

  statusTexto.textContent = "Solicitando permissão de localização...";
  btnGps.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      statusTexto.textContent = "Localização obtida! Buscando UBS mais próximas...";
      processarEExibirMaisProximas(position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      statusTexto.textContent = "Não foi possível obter sua localização pelo GPS. Tente digitar o CEP.";
      btnGps.disabled = false;
      console.warn(error);
    }
  );
});

btnCep.addEventListener('click', async () => {
  const cep = inputCep.value.replace(/\D/g, '');

  if (cep.length !== 8) {
    statusTexto.textContent = "Por favor, digite um CEP válido com 8 dígitos.";
    return;
  }

  statusTexto.textContent = "Buscando coordenadas do CEP...";
  btnCep.disabled = true;

  try {
    const viaCepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!viaCepRes.ok) {
      statusTexto.textContent = "Erro ao consultar o CEP. Tente novamente.";
      btnCep.disabled = false;
      return;
    }
    const dadosCep = await viaCepRes.json();

    if (dadosCep.erro) {
      statusTexto.textContent = "CEP não encontrado.";
      btnCep.disabled = false;
      return;
    }

    const headersNominatim = {
      'User-Agent': 'LocalizadorDeUBS/1.0 (antonio.bezerra@example.com)' 
    };

    const queryEndereco = encodeURIComponent(`${dadosCep.logradouro}, ${dadosCep.bairro}, ${dadosCep.localidade}, Brasil`);
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${queryEndereco}&limit=1`, {
      headers: headersNominatim
    });

    if (!geoRes.ok) {
      statusTexto.textContent = "Erro ao localizar coordenadas do CEP.";
      btnCep.disabled = false;
      return;
    }
    const dadosGeo = await geoRes.json();

    if (dadosGeo.length > 0) {
      statusTexto.textContent = `Endereço localizado: ${dadosCep.bairro} - ${dadosCep.localidade}. Buscando...`;
      await processarEExibirMaisProximas(dadosGeo[0].lat, dadosGeo[0].lon);
      return;
    }

    const queryCidade = encodeURIComponent(`${dadosCep.localidade}, ${dadosCep.uf}, Brasil`);
    const geoCidadeRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${queryCidade}&limit=1`, {
      headers: headersNominatim
    });

    if (!geoCidadeRes.ok) {
      statusTexto.textContent = "Não conseguimos obter as coordenadas geográficas deste CEP.";
      btnCep.disabled = false;
      return;
    }
    const dadosGeoCidade = await geoCidadeRes.json();

    if (dadosGeoCidade.length > 0) {
      statusTexto.textContent = `Aproximado pelo centro de ${dadosCep.localidade}. Buscando...`;
      await processarEExibirMaisProximas(dadosGeoCidade[0].lat, dadosGeoCidade[0].lon);
    } else {
      statusTexto.textContent = "Não conseguimos obter as coordenadas geográficas deste CEP.";
      btnCep.disabled = false;
    }

  } catch (error) {
    statusTexto.textContent = "Erro ao processar o CEP. Verifique sua conexão.";
    btnCep.disabled = false;
    console.error(error);
  }
});
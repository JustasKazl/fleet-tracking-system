// fleet-dashboard/src/pages/Privacy.jsx
import { Link } from 'react-router-dom';
import '../styles/legal.css';

function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="back-link">← Grįžti į pagrindinį</Link>
        
        <h1>Privatumo politika</h1>
        <p className="last-updated">Atnaujinta: 2025-12-11</p>

        <section>
          <h2>1. Įvadas</h2>
          <p>
            FleetTrack ("mes", "mūsų") gerbia jūsų privatumą ir įsipareigoja apsaugoti 
            jūsų asmens duomenis. Ši privatumo politika paaiškina, kaip rinkime, naudojame 
            ir saugome jūsų informaciją.
          </p>
        </section>

        <section>
          <h2>2. Renkami duomenys</h2>
          <p>Mes renkame šiuos duomenis:</p>
          <ul>
            <li><strong>Paskyros informacija:</strong> vardas, el. paštas, įmonės pavadinimas</li>
            <li><strong>GPS duomenys:</strong> automobilių lokacijos, maršrutai, greitis</li>
            <li><strong>Techniniai duomenys:</strong> IP adresas, naršyklės tipas, įrenginio informacija</li>
            <li><strong>Naudojimo duomenys:</strong> kaip naudojate mūsų paslaugą</li>
          </ul>
        </section>

        <section>
          <h2>3. Duomenų naudojimas</h2>
          <p>Jūsų duomenis naudojame šiems tikslams:</p>
          <ul>
            <li>Teikti ir tobulinti FleetTrack paslaugas</li>
            <li>Siųsti pranešimus apie paslaugą</li>
            <li>Analizuoti naudojimą ir tobulinti funkionalumą</li>
            <li>Užtikrinti saugumą ir kovoti su sukčiavimu</li>
            <li>Laikytis teisinių įsipareigojimų</li>
          </ul>
        </section>

        <section>
          <h2>4. Duomenų dalijimasis</h2>
          <p>
            Mes NESIDALIJAME jūsų asmeniniais duomenimis su trečiosiomis šalimis, 
            išskyrus šiuos atvejus:
          </p>
          <ul>
            <li>Kai jūs duodate aiškų sutikimą</li>
            <li>Paslaugų teikėjams (pvz., debesų serveriai, mokėjimų sistema)</li>
            <li>Kai to reikalauja įstatymai ar teismo sprendimai</li>
          </ul>
        </section>

        <section>
          <h2>5. Duomenų saugojimas</h2>
          <p>
            Jūsų duomenys saugomi Railway platformoje (Europos serveriuose). 
            Naudojame šifravimą, ugniasienę ir kitas saugumo priemones. 
            GPS duomenys saugomi 2 metus, po to automatiškai ištrinami.
          </p>
        </section>

        <section>
          <h2>6. Jūsų teisės (GDPR)</h2>
          <p>Pagal GDPR turite teisę:</p>
          <ul>
            <li><strong>Prieiga:</strong> gauti savo duomenų kopiją</li>
            <li><strong>Taisymas:</strong> ištaisyti neteisingus duomenis</li>
            <li><strong>Ištrynimas:</strong> prašyti ištrinti savo duomenis</li>
            <li><strong>Perkeliamumas:</strong> gauti duomenis struktūrizuotu formatu</li>
            <li><strong>Prieštaravimas:</strong> nesutikti su tam tikru duomenų naudojimu</li>
          </ul>
        </section>

        <section>
          <h2>7. Slapukai (Cookies)</h2>
          <p>
            Naudojame būtinus slapukus prisijungimui ir sesijos valdymui. 
            Analitiniai slapukai naudojami tik su jūsų sutikimu.
          </p>
        </section>

        <section>
          <h2>8. Vaikų privatumas</h2>
          <p>
            Mūsų paslauga nėra skirta asmenims jaunesniems nei 18 metų. 
            Mes sąmoningai nerenkame vaikų duomenų.
          </p>
        </section>

        <section>
          <h2>9. Politikos pakeitimai</h2>
          <p>
            Galime atnaujinti šią politiką. Apie reikšmingus pakeitimus informuosime 
            el. paštu 30 dienų prieš jiems įsigaliojant.
          </p>
        </section>

        <section>
          <h2>10. Kontaktai</h2>
          <p>
            Klausimai dėl privatumo ar norėdami pasinaudoti savo teisėmis:
            <br />
            El. paštas: privacy@fleettrack.lt
            <br />
            Telefonas: +370 600 00000
            <br />
            Adresas: Vilnius, Lietuva
          </p>
        </section>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

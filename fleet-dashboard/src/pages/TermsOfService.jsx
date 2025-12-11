// fleet-dashboard/src/pages/TermsOfService.jsx
import { Link } from 'react-router-dom';
import '../styles/legal.css';

function TermsOfService() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="back-link">← Grįžti į pagrindinį</Link>
        
        <h1>Naudojimo sąlygos</h1>
        <p className="last-updated">Atnaujinta: 2025-12-11</p>

        <section>
          <h2>1. Sutikimas su sąlygomis</h2>
          <p>
            Naudodamiesi FleetTrack paslauga, jūs sutinkate su šiomis naudojimo sąlygomis. 
            Jei nesutinkate su bet kuria šių sąlygų dalimi, prašome nenaudoti mūsų paslaugos.
          </p>
        </section>

        <section>
          <h2>2. Paslaugos aprašymas</h2>
          <p>
            FleetTrack yra transporto valdymo sistema, kuri teikia GPS stebėjimo, automobilių 
            valdymo ir duomenų analizės paslaugas. Mes pasiliekame teisę bet kuriuo metu keisti, 
            sustabdyti ar nutraukti bet kurią paslaugos dalį.
          </p>
        </section>

        <section>
          <h2>3. Vartotojo paskyra</h2>
          <p>
            Registruodamiesi FleetTrack paslaugai, jūs įsipareigojate:
          </p>
          <ul>
            <li>Pateikti tikslią, aktualią ir išsamią informaciją</li>
            <li>Palaikyti savo paskyros saugumą</li>
            <li>Nedelsiant pranešti apie bet kokį neteisėtą paskyros naudojimą</li>
            <li>Būti atsakingam už visas veiklas, vykdomas naudojant jūsų paskyrą</li>
          </ul>
        </section>

        <section>
          <h2>4. Mokėjimai ir atšaukimai</h2>
          <p>
            Nemokamas planas yra prieinamas visą laiką. Mokamų planų mokesčiai yra 
            nurodyti kainų puslapyje ir gali būti keičiami su 30 dienų įspėjimu. 
            Galite bet kuriuo metu atšaukti prenumeratą per savo paskyros nustatymus.
          </p>
        </section>

        <section>
          <h2>5. Draudžiami veiksmai</h2>
          <p>
            Naudodamiesi paslaugomis, jūs įsipareigojate:
          </p>
          <ul>
            <li>Nenaudoti paslaugos neteisėtiems tikslams</li>
            <li>Nebandyti gauti neteisėtos prieigos prie sistemų</li>
            <li>Neplatinti kenkėjiškų programų</li>
            <li>Nepažeisti kitų vartotojų teisių</li>
          </ul>
        </section>

        <section>
          <h2>6. Intelektinė nuosavybė</h2>
          <p>
            Visa FleetTrack platformos intelektinė nuosavybė priklauso mums arba 
            mūsų licencijos davėjams. Jūs gaunate ribotą, neatšaukiamą teisę naudoti 
            platformą pagal šias sąlygas.
          </p>
        </section>

        <section>
          <h2>7. Atsakomybės apribojimas</h2>
          <p>
            FleetTrack teikiamas "kaip yra" principu. Mes neatsakome už jokius nuostolius, 
            kylančius dėl paslaugos naudojimo ar negalėjimo naudotis paslauga. Maksimali 
            mūsų atsakomybė apsiriboja per paskutinius 12 mėnesių sumokėta suma.
          </p>
        </section>

        <section>
          <h2>8. Taikoma teisė</h2>
          <p>
            Šios sąlygos yra reglamentuojamos Lietuvos Respublikos įstatymais. 
            Visi ginčai sprendžiami Vilniaus miesto teismuose.
          </p>
        </section>

        <section>
          <h2>9. Kontaktai</h2>
          <p>
            Jei turite klausimų dėl šių sąlygų, susisiekite su mumis:
            <br />
            El. paštas: info@fleettrack.lt
            <br />
            Telefonas: +370 600 00000
          </p>
        </section>
      </div>
    </div>
  );
}

export default TermsOfService;

// fleet-dashboard/src/pages/PrivacyPolicy.jsx
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
            Naudojame šifrą vimą, ugniasienę ir kitas saugumo priemones. 
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

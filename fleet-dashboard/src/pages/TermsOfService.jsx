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

import BlurText from './BlurText';

export function SplashScreen() {
  return <div className="splash-copy">
    <h1><BlurText text="¿Se viene una fecha importante?" effect="drift" animateBy="words" direction="left" staggerFrom="end" trigger="view" delay={110} stepDuration={.5} blur={11} distance={70} focusOnHover/><br/><BlurText text="Cotízalo ;)" className="welcome-accent" effect="drift" animateBy="words" direction="left" staggerFrom="end" trigger="view" delay={110} stepDuration={.5} blur={11} distance={70} focusOnHover/></h1>
    <p>Toca al mono y cuéntanos qué estás planeando.</p>
  </div>;
}

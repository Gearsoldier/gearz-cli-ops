import fs from "fs";
import { Box, Text } from "ink";
import { render } from "ink";

export const runReport = () => {
  const content = `
  ██████╗ ███████╗ █████╗ ██████╗ ███████╗
  ██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝
  ██████╔╝█████╗  ███████║██████╔╝█████╗  
  ██╔═══╝ ██╔══╝  ██╔══██║██╔═══╝ ██╔══╝  
  ██║     ███████╗██║  ██║██║     ███████╗
  ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝

  🎯 Target: acme.com
  🔍 Found: 2 criticals, 4 low
  🧠 Next Step: Submit to platform or enhance payloads
  `;

  fs.writeFileSync("./report.txt", content);
  render(<Box padding={1}><Text color="green">📜 Report saved to report.txt</Text></Box>);
};

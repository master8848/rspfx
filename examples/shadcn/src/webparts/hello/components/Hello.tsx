import { useState, type JSX } from 'react';
import { Rocket } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import './globals.css';

export interface IHelloProps {
  description: string;
}

export default function Hello({ description }: IHelloProps): JSX.Element {
  const [name, setName] = useState('SharePoint');

  return (
    <div className="bg-background p-6">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Rocket className="text-primary" aria-hidden="true" />
              <CardTitle>shadcn/ui web part</CardTitle>
            </div>
            <Badge>Tailwind v4</Badge>
          </div>
          <CardDescription>React + shadcn/ui, no Fluent UI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                placeholder="Type a name…"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button variant="outline" onClick={() => setName('SharePoint')}>
                Reset
              </Button>
            </div>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Hello, <span className="font-medium text-foreground">{name}</span>!
          </p>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
